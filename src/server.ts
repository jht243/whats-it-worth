import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type WhatsItWorthWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve project root: prefer ASSETS_ROOT only if it actually has an assets/ directory
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = (() => {
  const envRoot = process.env.ASSETS_ROOT;
  if (envRoot) {
    const candidate = path.resolve(envRoot);
    try {
      const candidateAssets = path.join(candidate, "assets");
      if (fs.existsSync(candidateAssets)) {
        return candidate;
      }
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_ROOT_DIR;
})();

const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");
const LOGS_DIR = path.resolve(__dirname, "..", "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

type AnalyticsEvent = {
  timestamp: string;
  event: string;
  [key: string]: any;
};

function logAnalytics(event: string, data: Record<string, any> = {}) {
  const entry: AnalyticsEvent = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  const logLine = JSON.stringify(entry);
  console.log(logLine);

  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(LOGS_DIR, `${today}.log`);
  fs.appendFileSync(logFile, logLine + "\n");
}

function getRecentLogs(days: number = 7): AnalyticsEvent[] {
  const logs: AnalyticsEvent[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const logFile = path.join(LOGS_DIR, `${dateStr}.log`);

    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf8");
      const lines = content.trim().split("\n");
      lines.forEach((line) => {
        try {
          logs.push(JSON.parse(line));
        } catch (e) {}
      });
    }
  }

  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function classifyDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("cros")) return "ChromeOS";
  return "Other";
}

function computeSummary(args: any) {
  // Compute item valuation summary
  return {
    item_name: args.item_name || null,
    category: args.category || null,
    brand: args.brand || null,
    model: args.model || null,
    variant: args.variant || null,
    reference: args.reference || null,
    size_mm: args.size_mm || null,
    dial_color: args.dial_color || null,
    bezel_color: args.bezel_color || null,
    material: args.material || null,
    year: args.year || null,
    condition: args.condition || null,
  };
}

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "pnpm run build" before starting the server.`
    );
  }

  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;
  let loadedFrom = "";

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
    loadedFrom = directPath;
  } else {
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      const fallbackPath = path.join(ASSETS_DIR, fallback);
      htmlContents = fs.readFileSync(fallbackPath, "utf8");
      loadedFrom = fallbackPath;
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "pnpm run build" to generate the assets.`
    );
  }

  // Log what was loaded and check for "5%" in the badge
  const has5Percent = htmlContents.includes('<span class="rate-num">5%</span>');
  const isBlank = htmlContents.includes('<span class="rate-num"></span>');
  console.log(`[Widget Load] File: ${loadedFrom}`);
  console.log(`[Widget Load] Has "5%": ${has5Percent}, Is Blank: ${isBlank}`);
  console.log(`[Widget Load] HTML length: ${htmlContents.length} bytes`);

  return htmlContents;
}

// Use git commit hash for deterministic cache-busting across deploys
// Added timestamp suffix to force cache invalidation for width fix
const VERSION = (process.env.RENDER_GIT_COMMIT?.slice(0, 7) || Date.now().toString()) + '-' + Date.now();

function widgetMeta(widget: WhatsItWorthWidget, bustCache: boolean = false) {
  const templateUri = bustCache
    ? `ui://widget/whats-it-worth.html?v=${VERSION}`
    : widget.templateUri;

  return {
    "openai/outputTemplate": templateUri,
    "openai/widgetDescription":
      "A smart item valuation tool that tells you what your items are worth. Provides valuations for individual items or collections. Call this tool immediately with NO arguments to let the user enter their item details manually. Only provide arguments if the user has explicitly stated them.",
    "openai/componentDescriptions": {
      "item-form": "Input form for item details including description, condition, and category.",
      "valuation-display": "Display showing item valuation and market data.",
      "vault-list": "List of user's item vaults organized by category.",
      "price-sources": "Links to external marketplaces for price verification.",
    },
    "openai/widgetKeywords": [
      "valuation",
      "worth",
      "appraisal",
      "item value",
      "price check",
      "collectible",
      "antique",
      "watch",
      "jewelry",
      "art",
      "sports card",
      "memorabilia"
    ],
    "openai/sampleConversations": [
      { "user": "What is this item worth?", "assistant": "Here is What's It Worth. Enter your item details to find out its value." },
      { "user": "I have an antique vase from the 1800s", "assistant": "I'll help you find out what your antique vase is worth." },
      { "user": "How much is my vintage watch worth?", "assistant": "I've loaded What's It Worth. Let me help you find out the value of your vintage watch." },
    ],
    "openai/starterPrompts": [
      "What is my vintage watch worth?",
      "How much is this antique worth?",
      "Value my collection of baseball cards",
      "What's the market value of my guitar?",
      "How much should I sell this item for?",
      "Appraise my collectibles",
      "What's my Rolex Submariner worth?",
    ],
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [
        "https://whats-it-worth.onrender.com"
      ],
      resource_domains: [
        "https://whats-it-worth.onrender.com"
      ],
    },
    "openai/widgetDomain": "https://web-sandbox.oaiusercontent.com",
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: WhatsItWorthWidget[] = [
  {
    id: "whats-it-worth",
    title: "What's It Worth — Find out what your items are worth",
    templateUri: `ui://widget/whats-it-worth.html?v=${VERSION}`,
    invoking:
      "Opening What's It Worth...",
    invoked:
      "Here is What's It Worth. Enter your item details to find out their value.",
    html: readWidgetHtml("whats-it-worth"),
  },
];

const widgetsById = new Map<string, WhatsItWorthWidget>();
const widgetsByUri = new Map<string, WhatsItWorthWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

const toolInputSchema = {
  type: "object",
  properties: {
    item_name: { type: "string", description: "Name of the item to value (e.g., 'Rolex Submariner', 'Mickey Mantle rookie card')." },
    item_description: { type: "string", description: "Description of the item including condition, year, model, unique features." },
    category: { type: "string", enum: ["watches", "pens", "handbags", "sneakers", "jewelry", "cars", "motorcycles", "art", "sculptures", "prints", "antiques", "trading_cards", "pokemon", "mtg", "yugioh", "guitars", "vinyl", "instruments", "wine", "whiskey", "coins", "currency", "stamps", "toys", "lego", "funko", "comics", "books", "movie_props", "video_games", "sports", "golf", "cameras", "fashion", "sunglasses", "knives", "firearms", "electronics", "memorabilia", "pottery", "glass", "dolls", "other"], description: "Category of the collectible item. Choose the most specific category that matches." },
    brand: { type: "string", description: "Brand or manufacturer (e.g., 'Omega', 'Rolex', 'Patek Philippe')." },
    model: { type: "string", description: "Model name (e.g., 'Seamaster', 'Submariner', 'Speedmaster')." },
    variant: { type: "string", description: "Specific variant or sub-model (e.g., 'Diver 300M', 'Professional Moonwatch', 'Date')." },
    reference: { type: "string", description: "Reference number if visible (e.g., '210.30.42.20.03.001', '126610LN')." },
    size_mm: { type: "number", description: "Case size in millimeters (e.g., 42, 41, 40)." },
    dial_color: { type: "string", description: "Dial color (e.g., 'blue', 'black', 'white', 'silver', 'green')." },
    bezel_color: { type: "string", description: "Bezel color if different from dial (e.g., 'blue', 'black', 'ceramic')." },
    material: { type: "string", description: "Case/bracelet material (e.g., 'stainless steel', '18k gold', 'titanium', 'two-tone')." },
    year: { type: "number", description: "Year the item was made or released." },
    condition: { type: "string", enum: ["mint", "excellent", "good", "fair", "poor"], description: "Condition of the item." },
    estimated_price: { type: "number", description: "Your estimated market value in USD based on the item details, condition, and current market prices. Be specific and realistic." },
    price_range_low: { type: "number", description: "Low end of the estimated price range in USD." },
    price_range_high: { type: "number", description: "High end of the estimated price range in USD." },
    confidence: { type: "string", enum: ["low", "medium", "high"], description: "Your confidence in the price estimate based on how much information you have." },
  },
  required: [],
  additionalProperties: false,
  $schema: "http://json-schema.org/draft-07/schema#",
} as const;

const toolInputParser = z.object({
  item_name: z.string().optional(),
  item_description: z.string().optional(),
  category: z.enum(["watches", "pens", "handbags", "sneakers", "jewelry", "cars", "motorcycles", "art", "sculptures", "prints", "antiques", "trading_cards", "pokemon", "mtg", "yugioh", "guitars", "vinyl", "instruments", "wine", "whiskey", "coins", "currency", "stamps", "toys", "lego", "funko", "comics", "books", "movie_props", "video_games", "sports", "golf", "cameras", "fashion", "sunglasses", "knives", "firearms", "electronics", "memorabilia", "pottery", "glass", "dolls", "other"]).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  reference: z.string().optional(),
  size_mm: z.number().optional(),
  dial_color: z.string().optional(),
  bezel_color: z.string().optional(),
  material: z.string().optional(),
  year: z.number().optional(),
  condition: z.enum(["mint", "excellent", "good", "fair", "poor"]).optional(),
  estimated_price: z.number().optional(),
  price_range_low: z.number().optional(),
  price_range_high: z.number().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

const tools: Tool[] = widgets.map((widget) => ({
  name: widget.id,
  description:
    "Use this tool to find out what items are worth. Helps users get valuations for individual items or collections. Call this tool immediately with NO arguments to let the user enter their item details manually. Only provide arguments if the user has explicitly stated them.",
  inputSchema: toolInputSchema,
  outputSchema: {
    type: "object",
    properties: {
      ready: { type: "boolean" },
      timestamp: { type: "string" },
      item_name: { type: "string" },
      category: { type: "string" },
      input_source: { type: "string", enum: ["user", "default"] },
      summary: {
        type: "object",
        properties: {
          item_name: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
          brand: { type: ["string", "null"] },
          model: { type: ["string", "null"] },
          year: { type: ["number", "null"] },
          condition: { type: ["string", "null"] },
        },
      },
      suggested_followups: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  title: widget.title,
  securitySchemes: [{ type: "noauth" }],
  _meta: {
    ...widgetMeta(widget),
    "openai/visibility": "public",
    securitySchemes: [{ type: "noauth" }],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}));

const resources: Resource[] = widgets.map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description:
    "HTML template for the What's It Worth widget that provides item valuations.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description:
    "Template descriptor for the What's It Worth widget.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

function createWhatsItWorthServer(): Server {
  const server = new Server(
    {
      name: "whats-it-worth",
      version: "0.1.0",
      description:
        "What's It Worth helps users find out what an individual item or a collection of items is worth.",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => {
      console.log(`[MCP] resources/list called, returning ${resources.length} resources`);
      resources.forEach((r: any) => {
        console.log(`  - ${r.uri} (${r.name})`);
      });
      return { resources };
    }
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      const htmlToSend = widget.html;

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: htmlToSend,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({ resourceTemplates })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({ tools })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const startTime = Date.now();
      let userAgentString: string | null = null;
      let deviceCategory = "Unknown";
      
      // Log the full request to debug _meta location
      console.log("Full request object:", JSON.stringify(request, null, 2));
      
      try {
        const widget = widgetsById.get(request.params.name);

        if (!widget) {
          logAnalytics("tool_call_error", {
            error: "Unknown tool",
            toolName: request.params.name,
          });
          throw new Error(`Unknown tool: ${request.params.name}`);
        }

        // Parse and validate input parameters
        let args: z.infer<typeof toolInputParser> = {};
        try {
          args = toolInputParser.parse(request.params.arguments ?? {});
        } catch (parseError: any) {
          logAnalytics("parameter_parse_error", {
            toolName: request.params.name,
            params: request.params.arguments,
            error: parseError.message,
          });
          throw parseError;
        }

        // Capture user context from _meta - try multiple locations
        const meta = (request as any)._meta || request.params?._meta || {};
        const userLocation = meta["openai/userLocation"];
        const userLocale = meta["openai/locale"];
        const userAgent = meta["openai/userAgent"];
        userAgentString = typeof userAgent === "string" ? userAgent : null;
        deviceCategory = classifyDevice(userAgentString);
        
        // Debug log
        console.log("Captured meta:", { userLocation, userLocale, userAgent });

        // If ChatGPT didn't pass structured arguments, try to infer item details from freeform text in meta
        try {
          const candidates: any[] = [
            meta["openai/subject"],
            meta["openai/userPrompt"],
            meta["openai/userText"],
            meta["openai/lastUserMessage"],
            meta["openai/inputText"],
            meta["openai/requestText"],
          ];
          const userText = candidates.find((t) => typeof t === "string" && t.trim().length > 0) || "";

          // Infer watch brand from user text
          if (!args.brand) {
            const brandPatterns: [RegExp, string][] = [
              [/\bomega\b/i, "Omega"],
              [/\brolex\b/i, "Rolex"],
              [/\bpatek\s*philippe\b/i, "Patek Philippe"],
              [/\baudemars\s*piguet\b|\bap\b/i, "Audemars Piguet"],
              [/\bcartier\b/i, "Cartier"],
              [/\btudor\b/i, "Tudor"],
              [/\bbreitling\b/i, "Breitling"],
              [/\btag\s*heuer\b/i, "TAG Heuer"],
              [/\biwc\b/i, "IWC"],
              [/\bseiko\b/i, "Seiko"],
              [/\bgrand\s*seiko\b/i, "Grand Seiko"],
              [/\blongines\b/i, "Longines"],
              [/\btissot\b/i, "Tissot"],
              [/\bhamilton\b/i, "Hamilton"],
              [/\bzenith\b/i, "Zenith"],
              [/\bpanerai\b/i, "Panerai"],
              [/\bhublot\b/i, "Hublot"],
              [/\bvacheron\s*constantin\b/i, "Vacheron Constantin"],
              [/\bjaeger\s*lecoultre\b|\bjlc\b/i, "Jaeger-LeCoultre"],
            ];
            for (const [pattern, brand] of brandPatterns) {
              if (pattern.test(userText)) {
                args.brand = brand;
                break;
              }
            }
          }

          // Infer watch model from user text
          if (!args.model) {
            const modelPatterns: [RegExp, string][] = [
              [/\bseamaster\b/i, "Seamaster"],
              [/\bspeedmaster\b/i, "Speedmaster"],
              [/\bconstellation\b/i, "Constellation"],
              [/\bde\s*ville\b/i, "De Ville"],
              [/\bsubmariner\b/i, "Submariner"],
              [/\bdaytona\b/i, "Daytona"],
              [/\bdatejust\b/i, "Datejust"],
              [/\bgmt\s*master\b/i, "GMT-Master"],
              [/\bexplorer\b/i, "Explorer"],
              [/\broyal\s*oak\b/i, "Royal Oak"],
              [/\bnautilus\b/i, "Nautilus"],
              [/\baquanaut\b/i, "Aquanaut"],
              [/\bsantos\b/i, "Santos"],
              [/\btank\b/i, "Tank"],
              [/\bblack\s*bay\b/i, "Black Bay"],
              [/\bnavitimer\b/i, "Navitimer"],
              [/\bcarrera\b/i, "Carrera"],
              [/\bmonaco\b/i, "Monaco"],
              [/\bportugieser\b/i, "Portugieser"],
            ];
            for (const [pattern, model] of modelPatterns) {
              if (pattern.test(userText)) {
                args.model = model;
                break;
              }
            }
          }

          // Infer variant from user text
          if (!args.variant) {
            const variantPatterns: [RegExp, string][] = [
              [/\bdiver\s*300\s*m?\b/i, "Diver 300M"],
              [/\bplanet\s*ocean\b/i, "Planet Ocean"],
              [/\bprofessional\b|\bmoonwatch\b/i, "Professional Moonwatch"],
              [/\bdate\b/i, "Date"],
              [/\bno[\s-]*date\b/i, "No Date"],
              [/\bchronograph\b/i, "Chronograph"],
              [/\bgmt\b/i, "GMT"],
              [/\bperpetual\b/i, "Perpetual"],
            ];
            for (const [pattern, variant] of variantPatterns) {
              if (pattern.test(userText)) {
                args.variant = variant;
                break;
              }
            }
          }

          // Infer reference number (Omega format: 210.30.42.20.03.001, Rolex format: 126610LN)
          if (!args.reference) {
            const omegaRef = userText.match(/\b(\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{3})\b/);
            const rolexRef = userText.match(/\b(\d{5,6}[A-Z]{0,4})\b/);
            if (omegaRef) args.reference = omegaRef[1];
            else if (rolexRef) args.reference = rolexRef[1];
          }

          // Infer size in mm
          if (!args.size_mm) {
            const sizeMatch = userText.match(/\b(3[4-9]|4[0-8])\s*mm\b/i);
            if (sizeMatch) args.size_mm = parseInt(sizeMatch[1]);
          }

          // Infer dial color
          if (!args.dial_color) {
            const colorPatterns: [RegExp, string][] = [
              [/\bblue\s*dial\b/i, "blue"],
              [/\bblack\s*dial\b/i, "black"],
              [/\bwhite\s*dial\b/i, "white"],
              [/\bsilver\s*dial\b/i, "silver"],
              [/\bgreen\s*dial\b/i, "green"],
              [/\bgold\s*dial\b/i, "gold"],
              [/\bchampagne\s*dial\b/i, "champagne"],
              [/\bgray\s*dial\b|\bgrey\s*dial\b/i, "gray"],
            ];
            for (const [pattern, color] of colorPatterns) {
              if (pattern.test(userText)) {
                args.dial_color = color;
                break;
              }
            }
            // Fallback: just "blue", "black" etc. without "dial"
            if (!args.dial_color) {
              if (/\bblue\b/i.test(userText)) args.dial_color = "blue";
              else if (/\bblack\b/i.test(userText)) args.dial_color = "black";
              else if (/\bwhite\b/i.test(userText)) args.dial_color = "white";
              else if (/\bgreen\b/i.test(userText)) args.dial_color = "green";
            }
          }

          // Infer material
          if (!args.material) {
            if (/\bstainless\s*steel\b|\bsteel\b/i.test(userText)) args.material = "stainless steel";
            else if (/\b18k\s*gold\b|\byellow\s*gold\b/i.test(userText)) args.material = "18k yellow gold";
            else if (/\bwhite\s*gold\b/i.test(userText)) args.material = "18k white gold";
            else if (/\brose\s*gold\b/i.test(userText)) args.material = "18k rose gold";
            else if (/\btwo[\s-]*tone\b/i.test(userText)) args.material = "two-tone";
            else if (/\btitanium\b/i.test(userText)) args.material = "titanium";
            else if (/\bceramic\b/i.test(userText)) args.material = "ceramic";
          }

          // Infer car brands/models if not set
          if (!args.brand) {
            const carBrandPatterns: [RegExp, string][] = [
              [/\bford\b/i, "Ford"],
              [/\bchevy\b|\bchevrolet\b/i, "Chevrolet"],
              [/\bdodge\b/i, "Dodge"],
              [/\bferrari\b/i, "Ferrari"],
              [/\blamborghini\b/i, "Lamborghini"],
              [/\bporsche\b/i, "Porsche"],
              [/\bmercedes\b|\bmercedes[\s-]*benz\b/i, "Mercedes-Benz"],
              [/\bbmw\b/i, "BMW"],
              [/\baudi\b/i, "Audi"],
              [/\btoyota\b/i, "Toyota"],
              [/\bhonda\b/i, "Honda"],
              [/\bnissan\b/i, "Nissan"],
              [/\baston\s*martin\b/i, "Aston Martin"],
              [/\bmaserati\b/i, "Maserati"],
              [/\bbugatti\b/i, "Bugatti"],
              [/\brolls[\s-]*royce\b/i, "Rolls-Royce"],
              [/\bbentley\b/i, "Bentley"],
              [/\bjaguar\b/i, "Jaguar"],
              [/\bland\s*rover\b/i, "Land Rover"],
              [/\btesla\b/i, "Tesla"],
            ];
            for (const [pattern, brand] of carBrandPatterns) {
              if (pattern.test(userText)) {
                args.brand = brand;
                break;
              }
            }
          }

          // Infer car models
          if (!args.model) {
            const carModelPatterns: [RegExp, string][] = [
              [/\bmustang\b/i, "Mustang"],
              [/\bcamaro\b/i, "Camaro"],
              [/\bcorvette\b/i, "Corvette"],
              [/\bchallenger\b/i, "Challenger"],
              [/\bcharger\b/i, "Charger"],
              [/\b911\b/i, "911"],
              [/\bcayenne\b/i, "Cayenne"],
              [/\bmodel\s*s\b/i, "Model S"],
              [/\bmodel\s*3\b/i, "Model 3"],
              [/\bmodel\s*x\b/i, "Model X"],
              [/\bmodel\s*y\b/i, "Model Y"],
              [/\bcivic\b/i, "Civic"],
              [/\baccord\b/i, "Accord"],
              [/\bcamry\b/i, "Camry"],
              [/\bsupra\b/i, "Supra"],
              [/\bm3\b/i, "M3"],
              [/\bm5\b/i, "M5"],
              [/\bg[\s-]*wagon\b|\bg[\s-]*class\b/i, "G-Class"],
              [/\bf150\b|\bf-150\b/i, "F-150"],
              [/\bsilverado\b/i, "Silverado"],
            ];
            for (const [pattern, model] of carModelPatterns) {
              if (pattern.test(userText)) {
                args.model = model;
                break;
              }
            }
          }

          // Infer car variant/trim
          if (!args.variant) {
            const carVariantPatterns: [RegExp, string][] = [
              [/\bgt\b/i, "GT"],
              [/\bgt350\b/i, "GT350"],
              [/\bgt500\b/i, "GT500"],
              [/\bss\b/i, "SS"],
              [/\bzl1\b/i, "ZL1"],
              [/\bz06\b/i, "Z06"],
              [/\bzr1\b/i, "ZR1"],
              [/\bhellcat\b/i, "Hellcat"],
              [/\bsrt\b/i, "SRT"],
              [/\bamg\b/i, "AMG"],
              [/\bm\s*sport\b/i, "M Sport"],
              [/\bs[\s-]*line\b/i, "S-Line"],
              [/\btype[\s-]*r\b/i, "Type R"],
              [/\btrd\b/i, "TRD"],
              [/\bnismo\b/i, "NISMO"],
              [/\bturbo\b/i, "Turbo"],
              [/\bturbo\s*s\b/i, "Turbo S"],
            ];
            for (const [pattern, variant] of carVariantPatterns) {
              if (pattern.test(userText)) {
                args.variant = variant;
                break;
              }
            }
          }

          // Infer category if not set
          if (!args.category) {
            // Check for car brands/models first to set cars category
            const carIndicators = /\bmustang\b|\bcamaro\b|\bcorvette\b|\b911\b|\bferrari\b|\blamborghini\b|\bporsche\b|\bford\b|\bchevy\b|\bdodge\b|\btesla\b|\bbmw\b|\bmercedes\b|\baudi\b/i;
            if (carIndicators.test(userText)) args.category = "cars";
            else if (/\bwatch\b|\btimepiece\b|\bwristwatch\b|\brolex\b|\bomega\b|\bpatek\b|\baudemars\b|\bcartier\b/i.test(userText)) args.category = "watches";
            else if (/\bcar\b|\bvehicle\b|\bautomobile\b/i.test(userText)) args.category = "cars";
            else if (/\bjewelry\b|\bring\b|\bnecklace\b|\bbracelet\b|\bearring/i.test(userText)) args.category = "jewelry";
            else if (/\bpainting\b|\bart\b|\bsculpture\b/i.test(userText)) args.category = "art";
            else if (/\bcard\b|\bbaseball\b|\bsports\b|\bmemorabilia\b/i.test(userText)) args.category = "sports";
            else if (/\bsneaker\b|\bjordan\b|\byeezy\b|\bnike\b|\badidas\b/i.test(userText)) args.category = "sneakers";
            else if (/\bhandbag\b|\bpurse\b|\bbirkin\b|\bkelly\b|\bchanel\b|\blouis\s*vuitton\b|\blv\b|\bhermes\b/i.test(userText)) args.category = "handbags";
            else if (/\bguitar\b|\bfender\b|\bgibson\b|\bmartin\b/i.test(userText)) args.category = "guitars";
            else if (/\bpen\b|\bmontblanc\b|\bparker\b|\bwaterman\b/i.test(userText)) args.category = "pens";
          }

          // Infer year
          if (!args.year) {
            const yearMatch = userText.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
            if (yearMatch) args.year = parseInt(yearMatch[1]);
          }

          // Infer condition
          if (!args.condition) {
            if (/\bmint\b|\bnew\s*in\s*box\b|\bnib\b|\bunworn\b/i.test(userText)) args.condition = "mint";
            else if (/\bexcellent\b|\blike\s*new\b/i.test(userText)) args.condition = "excellent";
            else if (/\bgood\b|\bused\b/i.test(userText)) args.condition = "good";
            else if (/\bfair\b|\bworn\b/i.test(userText)) args.condition = "fair";
            else if (/\bpoor\b|\bdamaged\b|\bbroken\b/i.test(userText)) args.condition = "poor";
          }

        } catch (e) {
          console.warn("Parameter inference from meta failed", e);
        }


        const responseTime = Date.now() - startTime;

        // Check if we are using defaults (i.e. no arguments provided)
        const usedDefaults = Object.keys(args).length === 0;

        // Infer likely user query from parameters
        const inferredQuery = [] as string[];
        if (args.brand) inferredQuery.push(`Brand: ${args.brand}`);
        if (args.model) inferredQuery.push(`Model: ${args.model}`);
        if (args.variant) inferredQuery.push(`Variant: ${args.variant}`);
        if (args.reference) inferredQuery.push(`Ref: ${args.reference}`);
        if (args.category) inferredQuery.push(`Category: ${args.category}`);

        logAnalytics("tool_call_success", {
          toolName: request.params.name,
          params: args,
          inferredQuery: inferredQuery.length > 0 ? inferredQuery.join(", ") : "What's It Worth",
          responseTime,

          device: deviceCategory,
          userLocation: userLocation
            ? {
                city: userLocation.city,
                region: userLocation.region,
                country: userLocation.country,
                timezone: userLocation.timezone,
              }
            : null,
          userLocale,
          userAgent,
        });

        // Use a stable template URI so toolOutput reliably hydrates the component
        const widgetMetadata = widgetMeta(widget, false);
        console.log(`[MCP] Tool called: ${request.params.name}, returning templateUri: ${(widgetMetadata as any)["openai/outputTemplate"]}`);

        // Build structured content once so we can log it and return it.
        // For the valuation widget, expose fields relevant to item details
        const structured = {
          ready: true,
          timestamp: new Date().toISOString(),
          ...args,
          input_source: usedDefaults ? "default" : "user",
          // Summary + follow-ups for natural language UX
          summary: computeSummary(args),
          suggested_followups: [
            "How did you determine this value?",
            "Where can I sell this item?",
            "What affects the price the most?",
            "Is now a good time to sell?"
          ],
        } as const;

        // Embed the widget resource in _meta to mirror official examples and improve hydration reliability
        const metaForReturn = {
          ...widgetMetadata,
          "openai.com/widget": {
            type: "resource",
            resource: {
              uri: widget.templateUri,
              mimeType: "text/html+skybridge",
              text: widget.html,
              title: widget.title,
            },
          },
        } as const;

        console.log("[MCP] Returning outputTemplate:", (metaForReturn as any)["openai/outputTemplate"]);
        console.log("[MCP] Returning structuredContent:", structured);

        // Log success analytics
        try {
          // Check for "empty" result - when no main item inputs are provided
          const hasMainInputs = args.brand || args.model || args.item_name || args.category;
          
          if (!hasMainInputs) {
             logAnalytics("tool_call_empty", {
               toolName: request.params.name,
               params: request.params.arguments || {},
               reason: "No item details provided"
             });
          } else {
          logAnalytics("tool_call_success", {
            responseTime,
            params: request.params.arguments || {},
            inferredQuery: inferredQuery.join(", "),
            userLocation,
            userLocale,
            device: deviceCategory,
          });
          }
        } catch {}

        // TEXT SUPPRESSION: Return empty content array to prevent ChatGPT from adding
        // any text after the widget. The widget provides all necessary UI.
        // See: content: [] means no text content, only the widget is shown.
        return {
          content: [],  // Empty array = no text after widget
          structuredContent: structured,
          _meta: metaForReturn,  // Contains openai/resultCanProduceWidget: true
        };
      } catch (error: any) {
        logAnalytics("tool_call_error", {
          error: error.message,
          stack: error.stack,
          responseTime: Date.now() - startTime,
          device: deviceCategory,
          userAgent: userAgentString,
        });
        throw error;
      }
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";
const subscribePath = "/api/subscribe";
const analyticsPath = "/analytics";
const trackEventPath = "/api/track";
const healthPath = "/health";

const domainVerificationPath = "/.well-known/openai-apps-challenge";
const domainVerificationToken =
  process.env.OPENAI_DOMAIN_VERIFICATION_TOKEN ??
  "X1C2u_pL7rpRTEqXIorF7SPz-yc1ucHWvuIoUEEYwQE";

const ANALYTICS_PASSWORD = process.env.ANALYTICS_PASSWORD || "changeme123";

function checkAnalyticsAuth(req: IncomingMessage): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  return username === "admin" && password === ANALYTICS_PASSWORD;
}

function humanizeEventName(event: string): string {
  const eventMap: Record<string, string> = {
    tool_call_success: "Tool Call Success",
    tool_call_error: "Tool Call Error",
    parameter_parse_error: "Parameter Parse Error",
    widget_carousel_prev: "Carousel Previous",
    widget_carousel_next: "Carousel Next",
    widget_filter_age_change: "Filter: Age Change",
    widget_filter_state_change: "Filter: State Change",
    widget_filter_sort_change: "Filter: Sort Change",
    widget_filter_category_change: "Filter: Category Change",
    widget_user_feedback: "User Feedback",
    widget_test_event: "Test Event",
    widget_followup_click: "Follow-up Click",
    widget_crash: "Widget Crash",
  };
  return eventMap[event] || event;
}

function formatEventDetails(log: AnalyticsEvent): string {
  const excludeKeys = ["timestamp", "event"];
  const details: Record<string, any> = {};
  
  Object.keys(log).forEach((key) => {
    if (!excludeKeys.includes(key)) {
      details[key] = log[key];
    }
  });
  
  if (Object.keys(details).length === 0) {
    return "—";
  }
  
  return JSON.stringify(details, null, 0);
}

type AlertEntry = {
  id: string;
  level: "warning" | "critical";
  message: string;
};

function evaluateAlerts(logs: AnalyticsEvent[]): AlertEntry[] {
  const alerts: AlertEntry[] = [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 1. Tool Call Failures
  const toolErrors24h = logs.filter(
    (l) =>
      l.event === "tool_call_error" &&
      new Date(l.timestamp).getTime() >= dayAgo
  ).length;

  if (toolErrors24h > 5) {
    alerts.push({
      id: "tool-errors",
      level: "critical",
      message: `Tool failures in last 24h: ${toolErrors24h} (>5 threshold)`,
    });
  }

  // 2. Parameter Parsing Errors
  const parseErrorsWeek = logs.filter(
    (l) =>
      l.event === "parameter_parse_error" &&
      new Date(l.timestamp).getTime() >= weekAgo
  ).length;

  if (parseErrorsWeek > 3) {
    alerts.push({
      id: "parse-errors",
      level: "warning",
      message: `Parameter parse errors in last 7d: ${parseErrorsWeek} (>3 threshold)`,
    });
  }

  // 3. Empty Result Sets (missing item inputs)
  const successCalls = logs.filter(
    (l) => l.event === "tool_call_success" && new Date(l.timestamp).getTime() >= weekAgo
  );
  const emptyResults = logs.filter(
    (l) => l.event === "tool_call_empty" && new Date(l.timestamp).getTime() >= weekAgo
  ).length;

  const totalCalls = successCalls.length + emptyResults;
  if (totalCalls > 0 && (emptyResults / totalCalls) > 0.2) {
    alerts.push({
      id: "empty-results",
      level: "warning",
      message: `Empty result rate ${((emptyResults / totalCalls) * 100).toFixed(1)}% (>20% threshold)`,
    });
  }

  // 4. Widget Load Failures (Crashes)
  const widgetCrashes = logs.filter(
    (l) => l.event === "widget_crash" && new Date(l.timestamp).getTime() >= dayAgo
  ).length;

  if (widgetCrashes > 0) {
    alerts.push({
      id: "widget-crash",
      level: "critical",
      message: `Widget crashes in last 24h: ${widgetCrashes} (Fix immediately)`,
    });
  }

  // 5. Buttondown Subscription Failures
  const recentSubs = logs.filter(
    (l) =>
      (l.event === "widget_notify_me_subscribe" ||
        l.event === "widget_notify_me_subscribe_error") &&
      new Date(l.timestamp).getTime() >= weekAgo
  );

  const subFailures = recentSubs.filter(
    (l) => l.event === "widget_notify_me_subscribe_error"
  ).length;

  const failureRate =
    recentSubs.length > 0 ? subFailures / recentSubs.length : 0;

  if (recentSubs.length >= 5 && failureRate > 0.1) {
    alerts.push({
      id: "buttondown-failures",
      level: "warning",
      message: `Buttondown failure rate ${(failureRate * 100).toFixed(
        1
      )}% over last 7d (${subFailures}/${recentSubs.length})`,
    });
  }

  return alerts;
}

function generateAnalyticsDashboard(logs: AnalyticsEvent[], alerts: AlertEntry[]): string {
  const errorLogs = logs.filter((l) => l.event.includes("error"));
  const successLogs = logs.filter((l) => l.event === "tool_call_success");
  const parseLogs = logs.filter((l) => l.event === "parameter_parse_error");
  const widgetEvents = logs.filter((l) => l.event.startsWith("widget_"));

  const avgResponseTime =
    successLogs.length > 0
      ? (successLogs.reduce((sum, l) => sum + (l.responseTime || 0), 0) /
          successLogs.length).toFixed(0)
      : "N/A";

  const paramUsage: Record<string, number> = {};
  const categoryDist: Record<string, number> = {};
  const brandDist: Record<string, number> = {};
  
  successLogs.forEach((log) => {
    if (log.params) {
      Object.keys(log.params).forEach((key) => {
        if (log.params[key] !== undefined) {
          paramUsage[key] = (paramUsage[key] || 0) + 1;
        }
      });
      // Track category distribution
      if (log.params.category) {
        const category = log.params.category;
        categoryDist[category] = (categoryDist[category] || 0) + 1;
      }
      // Track brand distribution
      if (log.params.brand) {
        const brand = log.params.brand;
        brandDist[brand] = (brandDist[brand] || 0) + 1;
      }
    }
  });
  
  const widgetInteractions: Record<string, number> = {};
  widgetEvents.forEach((log) => {
    const humanName = humanizeEventName(log.event);
    widgetInteractions[humanName] = (widgetInteractions[humanName] || 0) + 1;
  });
  
  // Condition distribution
  const conditionDist: Record<string, number> = {};
  successLogs.forEach((log) => {
    if (log.params?.condition) {
      const condition = log.params.condition;
      conditionDist[condition] = (conditionDist[condition] || 0) + 1;
    }
  });

  // Price range distribution
  const priceRangeDist: Record<string, number> = {};
  successLogs.forEach((log) => {
    if (log.params?.estimated_price) {
      const price = log.params.estimated_price;
      let bucket = "Unknown";
      if (price < 100) bucket = "Under $100";
      else if (price < 1000) bucket = "$100-$999";
      else if (price < 10000) bucket = "$1K-$9.9K";
      else if (price < 100000) bucket = "$10K-$99K";
      else bucket = "$100K+";
      priceRangeDist[bucket] = (priceRangeDist[bucket] || 0) + 1;
    }
  });

  // Top models (for watches/items)
  const modelDist: Record<string, number> = {};
  successLogs.forEach((log) => {
    if (log.params?.model) {
      const model = log.params.model;
      modelDist[model] = (modelDist[model] || 0) + 1;
    }
  });

  // Valuation Actions
  const actionCounts: Record<string, number> = {
    "Add Item": 0,
    "Delete Item": 0,
    "Refine Price": 0, 
    "View Details": 0,
    "Reset Data": 0,
    "Print/Share": 0
  };

  widgetEvents.forEach(log => {
      if (log.event === "widget_add_item") actionCounts["Add Item"]++;
      if (log.event === "widget_delete_item") actionCounts["Delete Item"]++;
      if (log.event === "widget_refine_price") actionCounts["Refine Price"]++;
      if (log.event === "widget_view_details") actionCounts["View Details"]++;
      if (log.event === "widget_reset_data") actionCounts["Reset Data"]++;
      if (log.event === "widget_print_share") actionCounts["Print/Share"]++;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>What's It Worth Analytics</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a1a1a; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
    .card .value { font-size: 32px; font-weight: bold; color: #1a1a1a; }
    .card.error .value { color: #dc2626; }
    .card.success .value { color: #16a34a; }
    .card.warning .value { color: #ea580c; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; }
    td { color: #1f2937; font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .error-row { background: #fef2f2; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .timestamp { color: #9ca3af; font-size: 12px; }
    td strong { color: #1f2937; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 What's It Worth Analytics</h1>
    <p class="subtitle">Last 7 days • Auto-refresh every 60s</p>
    
    <div class="grid">
      <div class="card ${alerts.length ? "warning" : ""}">
        <h2>Alerts</h2>
        ${
          alerts.length
            ? `<ul style="padding-left:16px;margin:0;">${alerts
                .map(
                  (a) =>
                    `<li><strong>${a.level.toUpperCase()}</strong> — ${a.message}</li>`
                )
                .join("")}</ul>`
            : '<p style="color:#16a34a;">No active alerts</p>'
        }
      </div>
      <div class="card success">
        <h2>Total Calls</h2>
        <div class="value">${successLogs.length}</div>
      </div>
      <div class="card error">
        <h2>Errors</h2>
        <div class="value">${errorLogs.length}</div>
      </div>
      <div class="card warning">
        <h2>Parse Errors</h2>
        <div class="value">${parseLogs.length}</div>
      </div>
      <div class="card">
        <h2>Avg Response Time</h2>
        <div class="value">${avgResponseTime}<span style="font-size: 16px; color: #666;">ms</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <h2>Parameter Usage</h2>
      <table>
        <thead><tr><th>Parameter</th><th>Times Used</th><th>Usage %</th></tr></thead>
        <tbody>
          ${Object.entries(paramUsage)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([param, count]) => `
            <tr>
              <td><code>${param}</code></td>
              <td>${count}</td>
              <td>${((count / successLogs.length) * 100).toFixed(1)}%</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="grid" style="margin-bottom: 20px;">
      <div class="card">
        <h2>Item Categories</h2>
        <table>
          <thead><tr><th>Category</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(categoryDist).length > 0 ? Object.entries(categoryDist)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(
                ([category, count]) => `
              <tr>
                <td>${category}</td>
                <td>${count}</td>
              </tr>
            `
              )
              .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No data yet</td></tr>'}
          </tbody>
        </table>
      </div>
      
       <div class="card">
        <h2>User Actions</h2>
        <table>
          <thead><tr><th>Action</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(actionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(
                ([action, count]) => `
              <tr>
                <td>${action}</td>
                <td>${count}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>


    <div class="card" style="margin-bottom: 20px;">
      <h2>Widget Interactions</h2>
      <table>
        <thead><tr><th>Action</th><th>Count</th></tr></thead>
        <tbody>
          ${Object.entries(widgetInteractions).length > 0 ? Object.entries(widgetInteractions)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([action, count]) => `
            <tr>
              <td>${action}</td>
              <td>${count}</td>
            </tr>
          `
            )
            .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No data yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="grid" style="margin-bottom: 20px;">
      <div class="card">
        <h2>Item Condition</h2>
        <table>
          <thead><tr><th>Condition</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(conditionDist).length > 0 ? Object.entries(conditionDist)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(
                ([condition, count]) => `
              <tr>
                <td>${condition}</td>
                <td>${count}</td>
              </tr>
            `
              )
              .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No data yet</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="card">
        <h2>Price Ranges</h2>
        <table>
          <thead><tr><th>Range</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(priceRangeDist).length > 0 ? Object.entries(priceRangeDist)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(
                ([range, count]) => `
              <tr>
                <td>${range}</td>
                <td>${count}</td>
              </tr>
            `
              )
              .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No data yet</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="card">
        <h2>Top Brands</h2>
        <table>
          <thead><tr><th>Brand</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(brandDist).length > 0 ? Object.entries(brandDist)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 10)
              .map(
                ([brand, count]) => `
              <tr>
                <td>${brand}</td>
                <td>${count}</td>
              </tr>
            `
              )
              .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No data yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <h2>User Queries (Inferred from Tool Calls)</h2>
      <table>
        <thead><tr><th>Date</th><th>Query</th><th>Location</th><th>Locale</th></tr></thead>
        <tbody>
          ${successLogs.length > 0 ? successLogs
            .slice(0, 20)
            .map(
              (log) => `
            <tr>
              <td class="timestamp" style="white-space: nowrap;">${new Date(log.timestamp).toLocaleString()}</td>
              <td style="max-width: 400px;">${log.inferredQuery || "general search"}</td>
              <td style="font-size: 12px; color: #6b7280;">${log.userLocation ? `${log.userLocation.city || ''}, ${log.userLocation.region || ''}, ${log.userLocation.country || ''}`.replace(/^, |, $/g, '') : '—'}</td>
              <td style="font-size: 12px; color: #6b7280;">${log.userLocale || '—'}</td>
            </tr>
          `
            )
            .join("") : '<tr><td colspan="4" style="text-align: center; color: #9ca3af;">No queries yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <h2>User Feedback</h2>
      <table>
        <thead><tr><th>Date</th><th>Feedback</th></tr></thead>
        <tbody>
          ${logs.filter(l => l.event === "widget_user_feedback").length > 0 ? logs
            .filter(l => l.event === "widget_user_feedback")
            .slice(0, 20)
            .map(
              (log) => `
            <tr>
              <td class="timestamp" style="white-space: nowrap;">${new Date(log.timestamp).toLocaleString()}</td>
              <td style="max-width: 600px;">${log.feedback || "—"}</td>
            </tr>
          `
            )
            .join("") : '<tr><td colspan="2" style="text-align: center; color: #9ca3af;">No feedback yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Events (Last 50)</h2>
      <table>
        <thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead>
        <tbody>
          ${logs
            .slice(0, 50)
            .map(
              (log) => `
            <tr class="${log.event.includes("error") ? "error-row" : ""}">
              <td class="timestamp">${new Date(log.timestamp).toLocaleString()}</td>
              <td><strong>${humanizeEventName(log.event)}</strong></td>
              <td style="font-size: 12px; max-width: 600px; overflow: hidden; text-overflow: ellipsis;">${formatEventDetails(log)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div>
  <script>setTimeout(() => location.reload(), 60000);</script>
</body>
</html>`;
}

async function handleAnalytics(req: IncomingMessage, res: ServerResponse) {
  if (!checkAnalyticsAuth(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Analytics Dashboard"',
      "Content-Type": "text/plain",
    });
    res.end("Authentication required");
    return;
  }

  try {
    const logs = getRecentLogs(7);
    const alerts = evaluateAlerts(logs);
    alerts.forEach((alert) =>
      console.warn("[ALERT]", alert.id, alert.message)
    );
    const html = generateAnalyticsDashboard(logs, alerts);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (error) {
    console.error("Analytics error:", error);
    res.writeHead(500).end("Failed to generate analytics");
  }
}

async function handleTrackEvent(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    const { event, data } = JSON.parse(body);

    if (!event) {
      res.writeHead(400).end(JSON.stringify({ error: "Missing event name" }));
      return;
    }

    logAnalytics(`widget_${event}`, data || {});

    res.writeHead(200).end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Track event error:", error);
    res.writeHead(500).end(JSON.stringify({ error: "Failed to track event" }));
  }
}

// Buttondown API integration
async function subscribeToButtondown(email: string, topicId: string, topicName: string) {
  const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;
  
  console.log("[Buttondown] subscribeToButtondown called", { email, topicId, topicName });
  console.log("[Buttondown] API key present:", !!BUTTONDOWN_API_KEY, "length:", BUTTONDOWN_API_KEY?.length ?? 0);

  if (!BUTTONDOWN_API_KEY) {
    throw new Error("BUTTONDOWN_API_KEY not set in environment variables");
  }

  const metadata: Record<string, any> = {
    topicName,
    source: "whats-it-worth",
    subscribedAt: new Date().toISOString(),
  };

  const requestBody = {
    email_address: email,
    tags: [topicId],
    metadata,
  };

  console.log("[Buttondown] Sending request body:", JSON.stringify(requestBody));

  const response = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      "Authorization": `Token ${BUTTONDOWN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[Buttondown] Response status:", response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to subscribe";
    
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.code) {
        errorMessage = `Error: ${errorData.code}`;
      }
    } catch {
      errorMessage = errorText;
    }
    
    throw new Error(errorMessage);
  }

  return await response.json();
}

// Update existing subscriber with new topic
async function updateButtondownSubscriber(email: string, topicId: string, topicName: string) {
  const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;
  
  if (!BUTTONDOWN_API_KEY) {
    throw new Error("BUTTONDOWN_API_KEY not set in environment variables");
  }

  // First, get the subscriber ID
  const searchResponse = await fetch(`https://api.buttondown.email/v1/subscribers?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${BUTTONDOWN_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!searchResponse.ok) {
    throw new Error("Failed to find subscriber");
  }

  const subscribers = await searchResponse.json();
  if (!subscribers.results || subscribers.results.length === 0) {
    throw new Error("Subscriber not found");
  }

  const subscriber = subscribers.results[0];
  const subscriberId = subscriber.id;

  // Update the subscriber with new tag and metadata
  const existingTags = subscriber.tags || [];
  const existingMetadata = subscriber.metadata || {};

  // Add new topic to tags if not already there
  const updatedTags = existingTags.includes(topicId) ? existingTags : [...existingTags, topicId];

  // Add new topic to metadata (Buttondown requires string values)
  const topicKey = `topic_${topicId}`;
  const topicData = JSON.stringify({
    name: topicName,
    subscribedAt: new Date().toISOString(),
  });
  
  const updatedMetadata = {
    ...existingMetadata,
    [topicKey]: topicData,
    source: "whats-it-worth",
  };

  const updateRequestBody = {
    tags: updatedTags,
    metadata: updatedMetadata,
  };

  console.log("[Buttondown] updateButtondownSubscriber called", { email, topicId, topicName, subscriberId });
  console.log("[Buttondown] Sending update request body:", JSON.stringify(updateRequestBody));

  const updateResponse = await fetch(`https://api.buttondown.email/v1/subscribers/${subscriberId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Token ${BUTTONDOWN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateRequestBody),
  });

  console.log("[Buttondown] Update response status:", updateResponse.status, updateResponse.statusText);

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update subscriber: ${errorText}`);
  }

  return await updateResponse.json();
}

async function handleSubscribe(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    // Support both old (settlementId/settlementName) and new (topicId/topicName) field names
    const parsed = JSON.parse(body);
    const email = parsed.email;
    const topicId = parsed.topicId || parsed.settlementId || "whats-it-worth";
    const topicName = parsed.topicName || parsed.settlementName || "What's It Worth Updates";
    if (!email || !email.includes("@")) {
      res.writeHead(400).end(JSON.stringify({ error: "Invalid email address" }));
      return;
    }

    const BUTTONDOWN_API_KEY_PRESENT = !!process.env.BUTTONDOWN_API_KEY;
    if (!BUTTONDOWN_API_KEY_PRESENT) {
      res.writeHead(500).end(JSON.stringify({ error: "Server misconfigured: BUTTONDOWN_API_KEY missing" }));
      return;
    }

    try {
      await subscribeToButtondown(email, topicId, topicName);
      res.writeHead(200).end(JSON.stringify({ 
        success: true, 
        message: "Successfully subscribed! You'll receive valuation tips and updates." 
      }));
    } catch (subscribeError: any) {
      const rawMessage = String(subscribeError?.message ?? "").trim();
      const msg = rawMessage.toLowerCase();
      const already = msg.includes('already subscribed') || msg.includes('already exists') || msg.includes('already on your list') || msg.includes('subscriber already exists') || msg.includes('already');

      if (already) {
        console.log("Subscriber already on list, attempting update", { email, topicId, message: rawMessage });
        try {
          await updateButtondownSubscriber(email, topicId, topicName);
          res.writeHead(200).end(JSON.stringify({ 
            success: true, 
            message: "You're now subscribed to this topic!" 
          }));
        } catch (updateError: any) {
          console.warn("Update subscriber failed, returning graceful success", {
            email,
            topicId,
            error: updateError?.message,
          });
          logAnalytics("widget_notify_me_subscribe_error", {
            stage: "update",
            email,
            error: updateError?.message,
          });
          res.writeHead(200).end(JSON.stringify({
            success: true,
            message: "You're already subscribed! We'll keep you posted.",
          }));
        }
        return;
      }

      logAnalytics("widget_notify_me_subscribe_error", {
        stage: "subscribe",
        email,
        error: rawMessage || "unknown_error",
      });
      throw subscribeError;
    }
  } catch (error: any) {
    console.error("Subscribe error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    logAnalytics("widget_notify_me_subscribe_error", {
      stage: "handler",
      email: undefined,
      error: error.message || "unknown_error",
    });
    res.writeHead(500).end(JSON.stringify({ 
      error: error.message || "Failed to subscribe. Please try again." 
    }));
  }
}

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  const server = createWhatsItWorthServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  // Keep-alive ping to prevent proxy/load balancer timeouts
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, 30000); // Send keep-alive every 30 seconds

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    clearInterval(keepAliveInterval);
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    clearInterval(keepAliveInterval);
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    clearInterval(keepAliveInterval);
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === healthPath) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
      return;
    }

    if (req.method === "GET" && url.pathname === domainVerificationPath) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(
        domainVerificationToken
      );
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    if (url.pathname === subscribePath) {
      await handleSubscribe(req, res);
      return;
    }

    if (url.pathname === analyticsPath) {
      await handleAnalytics(req, res);
      return;
    }

    if (url.pathname === trackEventPath) {
      await handleTrackEvent(req, res);
      return;
    }

    // Serve alias for legacy loader path -> our main widget HTML
    if (req.method === "GET" && url.pathname === "/assets/whats-it-worth.html") {
      const mainAssetPath = path.join(ASSETS_DIR, "whats-it-worth.html");
      console.log(`[Debug Legacy] Request: ${url.pathname}, Main Path: ${mainAssetPath}, Exists: ${fs.existsSync(mainAssetPath)}`);
      if (fs.existsSync(mainAssetPath) && fs.statSync(mainAssetPath).isFile()) {
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(mainAssetPath).pipe(res);
        return;
      }
    }

    // Serve static assets from /assets directory
    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const assetPath = path.join(ASSETS_DIR, url.pathname.slice(8));
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml"
        };
        const contentType = contentTypeMap[ext] || "application/octet-stream";
        res.writeHead(200, { 
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        });

        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

function startMonitoring() {
  // Check alerts every hour
  setInterval(() => {
    try {
      const logs = getRecentLogs(7);
      const alerts = evaluateAlerts(logs);
      
      if (alerts.length > 0) {
        console.log("\n=== 🚨 ACTIVE ALERTS 🚨 ===");
        alerts.forEach(alert => {
          console.log(`[ALERT] [${alert.level.toUpperCase()}] ${alert.message}`);
        });
        console.log("===========================\n");
      }
    } catch (e) {
      console.error("Monitoring check failed:", e);
    }
  }, 60 * 60 * 1000); // 1 hour
}

httpServer.listen(port, () => {
  startMonitoring();
  console.log(`What's It Worth MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});
