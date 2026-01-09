import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  RotateCcw, ChevronDown, ChevronUp, X, Mail, MessageSquare, Heart, Printer, Check, Info,
  Plus, Camera, Upload, Trash2, TrendingUp, TrendingDown, DollarSign, Package, Watch, Car,
  Gem, Frame, Monitor, Trophy, Box, RefreshCw, Edit3, ChevronRight, Sparkles
} from "lucide-react";

const COLORS = {
  primary: "#56C596", primaryDark: "#3aa87b", bg: "#FAFAFA", card: "#FFFFFF",
  textMain: "#1A1A1A", textSecondary: "#9CA3AF", border: "#F3F4F6",
  inputBg: "#F9FAFB", accentLight: "#E6F7F0", blue: "#5D9CEC", yellow: "#F59E0B",
  red: "#FF6B6B", orange: "#F2994A", orangeLight: "#FFF7ED", purple: "#8B5CF6",
  gold: "#F59E0B", teal: "#14B8A6"
};

// ============ DATA TYPES ============

interface PricePoint {
  date: string;
  value: number;
}

interface ItemMetadata {
  brand?: string;
  model?: string;
  year?: number;
  condition?: "mint" | "excellent" | "good" | "fair" | "poor";
  reference?: string;
  size_mm?: number;
  dial_color?: string;
  bezel_color?: string;
  material?: string;
  variant?: string;
  [key: string]: any;
}

interface PriceSource {
  name: string;
  price: number;
  date: string;
  url?: string;
  type: "sold" | "listing" | "auction" | "appraisal";
}

interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  imageData?: string; // base64 image
  estimatedValue: number;
  valueRange: { low: number; high: number };
  confidence: "low" | "medium" | "high";
  priceHistory: PricePoint[];
  priceSources: PriceSource[];
  metadata: ItemMetadata;
  createdAt: string;
  updatedAt: string;
}

interface Vault {
  id: string;
  name: string;
  category: string;
  icon: string;
  itemIds: string[];
  createdAt: string;
}

interface AppData {
  items: Item[];
  vaults: Vault[];
  lastPriceUpdate: string;
}

// ============ CATEGORY DEFINITIONS ============
// Top 50+ collectible categories with comprehensive keywords

const CATEGORIES: Record<string, { name: string; icon: React.ReactNode; keywords: string[] }> = {
  // Luxury & Fashion
  watches: { 
    name: "Watches", 
    icon: <Watch size={20} />,
    keywords: ["watch", "rolex", "omega", "patek", "audemars", "timepiece", "chronograph", "seiko", "cartier", "breitling", "tag heuer", "iwc", "vacheron", "jaeger", "panerai", "hublot", "tudor", "zenith", "grand seiko", "a. lange", "blancpain", "glashutte", "wristwatch"]
  },
  pens: {
    name: "Luxury Pens",
    icon: <Box size={20} />,
    keywords: ["pen", "fountain pen", "montblanc", "mont blanc", "parker", "waterman", "pelikan", "visconti", "aurora", "sailor", "pilot", "lamy", "cross", "sheaffer", "ballpoint", "rollerball", "writing instrument", "meisterstuck", "starwalker"]
  },
  handbags: {
    name: "Handbags & Accessories",
    icon: <Box size={20} />,
    keywords: ["handbag", "purse", "bag", "hermes", "birkin", "kelly", "chanel", "louis vuitton", "lv", "gucci", "prada", "dior", "fendi", "bottega", "celine", "ysl", "saint laurent", "clutch", "tote"]
  },
  sneakers: {
    name: "Sneakers & Footwear",
    icon: <Box size={20} />,
    keywords: ["sneaker", "sneakers", "shoe", "shoes", "nike", "jordan", "air jordan", "yeezy", "adidas", "new balance", "converse", "vans", "puma", "reebok", "asics", "dunks", "dunk", "air max", "air force", "travis scott", "off-white", "footwear", "kicks"]
  },
  jewelry: { 
    name: "Jewelry", 
    icon: <Gem size={20} />,
    keywords: ["jewelry", "ring", "necklace", "bracelet", "diamond", "gold", "silver", "platinum", "earring", "pendant", "brooch", "gemstone", "ruby", "emerald", "sapphire", "tiffany", "cartier", "bulgari", "van cleef", "harry winston"]
  },
  
  // Vehicles
  cars: { 
    name: "Cars & Vehicles", 
    icon: <Car size={20} />,
    keywords: ["car", "vehicle", "automobile", "ferrari", "porsche", "lamborghini", "classic car", "vintage car", "corvette", "mustang", "mercedes", "bmw", "aston martin", "maserati", "bugatti", "rolls royce", "bentley", "jaguar", "muscle car"]
  },
  motorcycles: {
    name: "Motorcycles",
    icon: <Car size={20} />,
    keywords: ["motorcycle", "motorbike", "harley", "harley-davidson", "ducati", "honda", "yamaha", "kawasaki", "suzuki", "triumph", "indian", "bmw motorrad", "chopper", "cruiser", "sportbike"]
  },
  
  // Art & Antiques
  art: { 
    name: "Fine Art", 
    icon: <Frame size={20} />,
    keywords: ["art", "painting", "oil painting", "watercolor", "acrylic", "canvas", "original art", "fine art", "contemporary art", "modern art", "impressionist", "abstract", "portrait", "landscape"]
  },
  sculptures: {
    name: "Sculptures",
    icon: <Frame size={20} />,
    keywords: ["sculpture", "statue", "bronze", "marble", "figurine", "bust", "carving", "wood carving", "stone sculpture"]
  },
  prints: {
    name: "Prints & Posters",
    icon: <Frame size={20} />,
    keywords: ["print", "lithograph", "serigraph", "screenprint", "etching", "woodcut", "poster", "limited edition print", "signed print", "numbered print", "giclée", "giclee"]
  },
  antiques: {
    name: "Antiques",
    icon: <Box size={20} />,
    keywords: ["antique", "antiques", "victorian", "edwardian", "georgian", "art deco", "art nouveau", "mid-century", "vintage furniture", "period furniture", "heirloom"]
  },
  
  // Collectible Cards & Games
  trading_cards: { 
    name: "Trading Cards", 
    icon: <Trophy size={20} />,
    keywords: ["trading card", "sports card", "baseball card", "basketball card", "football card", "hockey card", "rookie card", "graded card", "psa", "bgs", "sgc", "topps", "panini", "upper deck", "fleer"]
  },
  pokemon: {
    name: "Pokémon",
    icon: <Box size={20} />,
    keywords: ["pokemon", "pokémon", "pikachu", "charizard", "booster", "pokemon card", "tcg", "psa pokemon", "base set", "first edition", "shadowless", "japanese pokemon"]
  },
  mtg: {
    name: "Magic: The Gathering",
    icon: <Box size={20} />,
    keywords: ["magic the gathering", "mtg", "black lotus", "mox", "dual land", "reserved list", "alpha", "beta", "unlimited", "magic card"]
  },
  yugioh: {
    name: "Yu-Gi-Oh!",
    icon: <Box size={20} />,
    keywords: ["yugioh", "yu-gi-oh", "blue-eyes", "dark magician", "exodia", "yugioh card"]
  },
  
  // Music & Instruments
  guitars: {
    name: "Guitars",
    icon: <Box size={20} />,
    keywords: ["guitar", "fender", "gibson", "stratocaster", "les paul", "telecaster", "acoustic guitar", "electric guitar", "bass guitar", "martin", "taylor", "prs", "ibanez", "gretsch"]
  },
  vinyl: {
    name: "Vinyl Records",
    icon: <Box size={20} />,
    keywords: ["vinyl", "record", "lp", "album", "first pressing", "original pressing", "rare vinyl", "beatles", "led zeppelin", "pink floyd", "45 rpm", "33 rpm", "turntable"]
  },
  instruments: {
    name: "Musical Instruments",
    icon: <Box size={20} />,
    keywords: ["instrument", "piano", "violin", "cello", "saxophone", "trumpet", "drums", "stradivarius", "steinway", "keyboard", "synthesizer"]
  },
  
  // Wine & Spirits
  wine: {
    name: "Wine",
    icon: <Box size={20} />,
    keywords: ["wine", "vintage wine", "bordeaux", "burgundy", "champagne", "cabernet", "pinot", "merlot", "chardonnay", "dom perignon", "petrus", "romanee", "opus one", "screaming eagle"]
  },
  whiskey: {
    name: "Whiskey & Spirits",
    icon: <Box size={20} />,
    keywords: ["whiskey", "whisky", "bourbon", "scotch", "single malt", "macallan", "pappy van winkle", "yamazaki", "hibiki", "cognac", "hennessy", "remy martin", "rum", "tequila", "mezcal"]
  },
  
  // Coins & Currency
  coins: {
    name: "Coins",
    icon: <Box size={20} />,
    keywords: ["coin", "coins", "numismatic", "gold coin", "silver coin", "rare coin", "morgan dollar", "silver eagle", "krugerrand", "maple leaf", "american eagle", "pcgs", "ngc", "ancient coin", "commemorative"]
  },
  currency: {
    name: "Currency & Banknotes",
    icon: <Box size={20} />,
    keywords: ["currency", "banknote", "paper money", "bill", "note", "confederate", "colonial currency", "pmg", "rare currency", "gold certificate", "silver certificate"]
  },
  
  // Stamps & Postal
  stamps: {
    name: "Stamps",
    icon: <Box size={20} />,
    keywords: ["stamp", "stamps", "philatelic", "postage", "first day cover", "rare stamp", "inverted jenny", "penny black", "stamp collection"]
  },
  
  // Toys & Collectibles
  toys: {
    name: "Toys",
    icon: <Box size={20} />,
    keywords: ["toy", "toys", "vintage toy", "action figure", "hot wheels", "matchbox", "barbie", "lego", "transformers", "star wars toy", "gi joe", "he-man", "funko", "beanie baby"]
  },
  lego: {
    name: "LEGO",
    icon: <Box size={20} />,
    keywords: ["lego", "legos", "lego set", "minifigure", "lego star wars", "lego technic", "lego creator", "retired lego", "sealed lego"]
  },
  funko: {
    name: "Funko & Figures",
    icon: <Box size={20} />,
    keywords: ["funko", "funko pop", "pop vinyl", "nendoroid", "hot toys", "sideshow", "statue", "collectible figure"]
  },
  
  // Comics & Books
  comics: {
    name: "Comics",
    icon: <Box size={20} />,
    keywords: ["comic", "comics", "comic book", "marvel", "dc", "spider-man", "batman", "superman", "x-men", "cgc", "cbcs", "golden age", "silver age", "first appearance", "key issue"]
  },
  books: {
    name: "Rare Books",
    icon: <Box size={20} />,
    keywords: ["book", "rare book", "first edition", "signed book", "antique book", "manuscript", "incunabula", "leather bound", "limited edition book"]
  },
  
  // Entertainment & Media
  movie_props: {
    name: "Movie Props & Memorabilia",
    icon: <Box size={20} />,
    keywords: ["movie prop", "screen used", "production used", "hollywood", "movie memorabilia", "film prop", "costume", "wardrobe"]
  },
  video_games: {
    name: "Video Games",
    icon: <Monitor size={20} />,
    keywords: ["video game", "game", "nintendo", "playstation", "xbox", "sega", "atari", "nes", "snes", "gameboy", "sealed game", "cib", "graded game", "wata", "vga", "retro game"]
  },
  
  // Sports
  sports: { 
    name: "Sports Memorabilia", 
    icon: <Trophy size={20} />,
    keywords: ["sports", "memorabilia", "signed", "autograph", "jersey", "game used", "game worn", "championship", "super bowl", "world series", "nba finals"]
  },
  golf: {
    name: "Golf",
    icon: <Trophy size={20} />,
    keywords: ["golf", "golf club", "putter", "driver", "scotty cameron", "titleist", "callaway", "taylormade", "ping", "masters", "pga"]
  },
  
  // Photography & Cameras
  cameras: {
    name: "Cameras & Photography",
    icon: <Monitor size={20} />,
    keywords: ["camera", "leica", "hasselblad", "rolleiflex", "nikon", "canon", "vintage camera", "film camera", "polaroid", "medium format", "35mm", "rangefinder", "photography"]
  },
  
  // Fashion & Accessories
  fashion: {
    name: "Designer Fashion",
    icon: <Box size={20} />,
    keywords: ["designer", "fashion", "haute couture", "runway", "vintage fashion", "chanel jacket", "hermes scarf", "silk scarf"]
  },
  sunglasses: {
    name: "Sunglasses & Eyewear",
    icon: <Box size={20} />,
    keywords: ["sunglasses", "eyewear", "ray-ban", "oakley", "persol", "oliver peoples", "tom ford", "gucci sunglasses", "vintage sunglasses"]
  },
  
  // Knives & Tools
  knives: {
    name: "Knives & Blades",
    icon: <Box size={20} />,
    keywords: ["knife", "knives", "pocket knife", "folding knife", "fixed blade", "benchmade", "spyderco", "chris reeve", "microtech", "damascus", "switchblade", "bowie", "custom knife"]
  },
  
  // Firearms (collectible/antique)
  firearms: {
    name: "Firearms & Militaria",
    icon: <Box size={20} />,
    keywords: ["firearm", "gun", "rifle", "pistol", "revolver", "antique gun", "military", "militaria", "wwi", "wwii", "civil war", "sword", "saber", "bayonet", "medal", "uniform"]
  },
  
  // Technology
  electronics: { 
    name: "Vintage Electronics", 
    icon: <Monitor size={20} />,
    keywords: ["electronics", "vintage", "apple", "macintosh", "ibm", "commodore", "retro computer", "walkman", "boombox", "vintage radio", "tube amp", "audio equipment"]
  },
  
  // Miscellaneous Collectibles
  memorabilia: {
    name: "Pop Culture Memorabilia",
    icon: <Box size={20} />,
    keywords: ["memorabilia", "celebrity", "autograph", "signed photo", "concert", "tour", "backstage", "vip", "rare memorabilia"]
  },
  pottery: {
    name: "Pottery & Ceramics",
    icon: <Box size={20} />,
    keywords: ["pottery", "ceramic", "porcelain", "china", "vase", "stoneware", "earthenware", "wedgwood", "meissen", "royal doulton", "limoges", "delft"]
  },
  glass: {
    name: "Glass & Crystal",
    icon: <Box size={20} />,
    keywords: ["glass", "crystal", "art glass", "murano", "lalique", "waterford", "baccarat", "tiffany glass", "carnival glass", "depression glass", "steuben"]
  },
  dolls: {
    name: "Dolls",
    icon: <Box size={20} />,
    keywords: ["doll", "dolls", "barbie", "american girl", "porcelain doll", "antique doll", "madame alexander", "blythe", "reborn"]
  },
  
  // Catch-all
  other: { 
    name: "Other Collectibles", 
    icon: <Box size={20} />,
    keywords: []
  }
};

// ============ STORAGE ============

const STORAGE_KEY = "WHATS_IT_WORTH_DATA";
const BANNER_STORAGE_KEY = "WHATS_IT_WORTH_BANNER_DISMISSED";

const DEFAULT_DATA: AppData = {
  items: [],
  vaults: [],
  lastPriceUpdate: new Date().toISOString()
};

const loadSavedData = (): AppData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Support both old format { data, timestamp } and direct data
      const data = parsed.data || parsed;
      return { ...DEFAULT_DATA, ...data };
    }
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_DATA;
};

const saveData = (data: AppData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data:", e);
  }
};

const resetAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BANNER_STORAGE_KEY);
};

// ============ AI VALUATION (Mock - will integrate with OpenAI) ============

const detectCategory = (text: string): string => {
  const lower = text.toLowerCase();
  for (const [category, info] of Object.entries(CATEGORIES)) {
    if (category === "other") continue;
    if (info.keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return "other";
};

// Price source templates by category
const PRICE_SOURCE_TEMPLATES: Record<string, { name: string; urlBase: string; type: PriceSource["type"] }[]> = {
  watches: [
    { name: "Chrono24", urlBase: "https://www.chrono24.com", type: "listing" },
    { name: "eBay Sold Listings", urlBase: "https://www.ebay.com/sch", type: "sold" },
    { name: "WatchCharts", urlBase: "https://watchcharts.com", type: "listing" },
    { name: "Bob's Watches", urlBase: "https://www.bobswatches.com", type: "listing" },
  ],
  cars: [
    { name: "Bring a Trailer", urlBase: "https://bringatrailer.com", type: "auction" },
    { name: "Hagerty Valuation", urlBase: "https://www.hagerty.com/valuation-tools", type: "appraisal" },
    { name: "Cars & Bids", urlBase: "https://carsandbids.com", type: "auction" },
    { name: "Hemmings", urlBase: "https://www.hemmings.com", type: "listing" },
  ],
  jewelry: [
    { name: "1stDibs", urlBase: "https://www.1stdibs.com", type: "listing" },
    { name: "Christie's", urlBase: "https://www.christies.com", type: "auction" },
    { name: "Worthy", urlBase: "https://www.worthy.com", type: "appraisal" },
    { name: "eBay Sold Listings", urlBase: "https://www.ebay.com/sch", type: "sold" },
  ],
  art: [
    { name: "Sotheby's", urlBase: "https://www.sothebys.com", type: "auction" },
    { name: "Christie's", urlBase: "https://www.christies.com", type: "auction" },
    { name: "Artnet Price Database", urlBase: "https://www.artnet.com/price-database", type: "sold" },
    { name: "Heritage Auctions", urlBase: "https://www.ha.com", type: "auction" },
  ],
  electronics: [
    { name: "eBay Sold Listings", urlBase: "https://www.ebay.com/sch", type: "sold" },
    { name: "PriceCharting", urlBase: "https://www.pricecharting.com", type: "sold" },
    { name: "Reverb", urlBase: "https://reverb.com", type: "listing" },
  ],
  sports: [
    { name: "PSA Card Facts", urlBase: "https://www.psacard.com/cardfacts", type: "sold" },
    { name: "eBay Sold Listings", urlBase: "https://www.ebay.com/sch", type: "sold" },
    { name: "PWCC Marketplace", urlBase: "https://www.pwccmarketplace.com", type: "auction" },
    { name: "Goldin Auctions", urlBase: "https://goldin.co", type: "auction" },
  ],
  other: [
    { name: "eBay Sold Listings", urlBase: "https://www.ebay.com/sch", type: "sold" },
    { name: "Etsy", urlBase: "https://www.etsy.com", type: "listing" },
    { name: "Ruby Lane", urlBase: "https://www.rubylane.com", type: "listing" },
  ]
};

const buildSearchQuery = (item: Pick<Item, "name" | "description" | "metadata" | "category">): string => {
  const m = item.metadata || {};

  const primaryParts = [
    m.brand,
    m.model,
    m.variant,
    m.reference,
    typeof m.size_mm === "number" ? `${m.size_mm}mm` : undefined,
    m.dial_color ? `${m.dial_color} dial` : undefined,
    m.bezel_color ? `${m.bezel_color} bezel` : undefined,
    m.material,
    typeof m.year === "number" ? `${m.year}` : undefined,
  ].filter(Boolean);

  const secondaryParts = [item.name, item.description].filter(Boolean);
  const raw = [...primaryParts, ...secondaryParts].join(" ").trim().replace(/\s+/g, " ");
  return raw.slice(0, 140);
};

const buildSourceSearchUrl = (sourceName: string, urlBase: string, query: string): string => {
  const base = urlBase.replace(/\/$/, "");
  const q = encodeURIComponent(query.trim());
  if (!q) return base;

  switch (sourceName) {
    case "Chrono24":
      return `${base}/search/index.htm?query=${q}`;
    case "eBay Sold Listings":
      return `${base}/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`;
    case "WatchCharts":
      return `${base}/search?query=${q}`;
    case "Bob's Watches":
      return `${base}/search?q=${q}`;
    case "Bring a Trailer":
      return `${base}/search/?q=${q}`;
    case "Cars & Bids":
      return `${base}/search?q=${q}`;
    case "Hemmings":
      return `${base}/search/?q=${q}`;
    case "1stDibs":
      return `${base}/search/?q=${q}`;
    case "Sotheby's":
      return `${base}/en/search?query=${q}`;
    case "Christie's":
      return `${base}/en/search?keyword=${q}`;
    case "Heritage Auctions":
      return `${base}/c/search-results.zx?Ntt=${q}`;
    case "Artnet Price Database":
      return `${base}/search?keyword=${q}`;
    case "PriceCharting":
      return `${base}/search-products?query=${q}`;
    case "Reverb":
      return `${base}/marketplace?query=${q}`;
    case "PSA Card Facts":
      return `${base}/search?q=${q}`;
    case "PWCC Marketplace":
      return `${base}/search?query=${q}`;
    case "Goldin Auctions":
      return `${base}/search?q=${q}`;
    case "Etsy":
      return `${base}/search?q=${q}`;
    case "Ruby Lane":
      return `${base}/search?query=${q}`;
    case "Hagerty Valuation":
      return base;
    case "Worthy":
      return base;
    default:
      return base;
  }
};

const guessColorNameFromRgb = (r: number, g: number, b: number): string | undefined => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const v = max / 255;
  const s = max === 0 ? 0 : delta / max;

  if (v < 0.18) return "black";
  if (s < 0.15 && v > 0.85) return "white";
  if (s < 0.2) return "gray";

  let h = 0;
  if (delta === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  if (h >= 200 && h <= 260) return "blue";
  if (h >= 90 && h <= 160) return "green";
  if (h >= 20 && h <= 55) return "gold";
  if (h >= 0 && h <= 15) return "red";
  if (h >= 300 && h <= 340) return "purple";
  return undefined;
};

const inferWatchColorsFromImageData = (imageData?: string): Promise<{
  dial_color?: string;
  bezel_color?: string;
}> => {
  return new Promise((resolve) => {
    if (!imageData) return resolve({});
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 160;
        const h = Math.max(1, Math.round((img.height / img.width) * w));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({});
        ctx.drawImage(img, 0, 0, w, h);

        const sample = (nx: number, ny: number) => {
          const x = Math.max(0, Math.min(w - 1, Math.round(nx * (w - 1))));
          const y = Math.max(0, Math.min(h - 1, Math.round(ny * (h - 1))));
          const d = ctx.getImageData(x, y, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2] };
        };

        const center = sample(0.5, 0.55);
        const ring = sample(0.5, 0.28);

        const dial = guessColorNameFromRgb(center.r, center.g, center.b);
        const bezel = guessColorNameFromRgb(ring.r, ring.g, ring.b);
        resolve({ dial_color: dial, bezel_color: bezel });
      } catch {
        resolve({});
      }
    };
    img.onerror = () => resolve({});
    img.src = imageData;
  });
};

const ensureItemPriceSources = (item: Item): Item => {
  const query = buildSearchQuery(item);
  const templates = PRICE_SOURCE_TEMPLATES[item.category] || PRICE_SOURCE_TEMPLATES.other;

  const templateByName = new Map(templates.map((t) => [t.name, t] as const));

  let changed = false;
  let nextSources: PriceSource[] = Array.isArray(item.priceSources) ? item.priceSources : [];

  if (nextSources.length === 0) {
    const today = new Date();
    nextSources = templates.slice(0, 3).map((t, idx) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (idx + 1) * 3);
      const price = Math.max(1, Math.round(item.estimatedValue * (0.92 + idx * 0.04)));
      return {
        name: t.name,
        price,
        date: d.toISOString().split("T")[0],
        url: buildSourceSearchUrl(t.name, t.urlBase, query),
        type: t.type,
      };
    });
    changed = true;
  } else {
    nextSources = nextSources.map((s) => {
      const template = templateByName.get(s.name);
      const baseForUrl = template?.urlBase || (() => {
        try {
          return s.url ? new URL(s.url).origin : "";
        } catch {
          return s.url || "";
        }
      })();

      const nextUrl = buildSourceSearchUrl(s.name, baseForUrl, query);
      if (nextUrl !== s.url) changed = true;
      return { ...s, url: nextUrl };
    });
  }

  if (!changed) return item;
  return { ...item, priceSources: nextSources };
};

const generateMockValuation = (name: string, description: string, category: string): Omit<Item, "id" | "createdAt" | "updatedAt" | "imageData"> => {
  // Mock AI valuation - in production this would call OpenAI
  const baseValues: Record<string, { min: number; max: number }> = {
    watches: { min: 500, max: 50000 },
    cars: { min: 5000, max: 500000 },
    jewelry: { min: 200, max: 100000 },
    art: { min: 100, max: 200000 },
    electronics: { min: 50, max: 5000 },
    sports: { min: 10, max: 50000 },
    other: { min: 50, max: 5000 }
  };

  const range = baseValues[category] || baseValues.other;
  const baseValue = Math.floor(Math.random() * (range.max - range.min) + range.min);
  const variance = 0.15; // 15% variance for range
  
  const low = Math.floor(baseValue * (1 - variance));
  const high = Math.floor(baseValue * (1 + variance));
  
  // Generate some price history (last 30 days)
  const priceHistory: PricePoint[] = [];
  const today = new Date();
  for (let i = 30; i >= 0; i -= 5) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const fluctuation = 1 + (Math.random() - 0.5) * 0.1; // +/- 5% daily fluctuation
    priceHistory.push({
      date: date.toISOString().split("T")[0],
      value: Math.floor(baseValue * fluctuation)
    });
  }

  // Generate price sources based on category
  const searchQuery = buildSearchQuery({ name, description, category, metadata: {} });
  const sourceTemplates = PRICE_SOURCE_TEMPLATES[category] || PRICE_SOURCE_TEMPLATES.other;
  const priceSources: PriceSource[] = sourceTemplates.slice(0, 3 + Math.floor(Math.random() * 2)).map((template, idx) => {
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const sourceDate = new Date(today);
    sourceDate.setDate(sourceDate.getDate() - daysAgo);
    
    // Vary prices around the base value
    const priceVariance = 0.2; // 20% variance between sources
    const sourcePrice = Math.floor(baseValue * (1 + (Math.random() - 0.5) * priceVariance));
    
    return {
      name: template.name,
      price: sourcePrice,
      date: sourceDate.toISOString().split("T")[0],
      url: buildSourceSearchUrl(template.name, template.urlBase, searchQuery),
      type: template.type
    };
  });

  // Extract potential metadata from description
  const metadata: ItemMetadata = {};
  const yearMatch = description.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) metadata.year = parseInt(yearMatch[0]);
  
  const conditionWords = ["mint", "excellent", "good", "fair", "poor"];
  for (const cond of conditionWords) {
    if (description.toLowerCase().includes(cond)) {
      metadata.condition = cond as ItemMetadata["condition"];
      break;
    }
  }

  if (category === "watches") {
    const hay = `${name} ${description}`.toLowerCase();
    if (!metadata.brand && hay.includes("omega")) metadata.brand = "Omega";
    if (!metadata.model && hay.includes("seamaster")) metadata.model = "Seamaster";
    if (!metadata.variant && (hay.includes("diver") || hay.includes("300"))) {
      metadata.variant = "Diver 300M";
    }

    const refMatch = `${name} ${description}`.match(/\b\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{3}\b/);
    if (!metadata.reference && refMatch) metadata.reference = refMatch[0];

    const sizeMatch = `${name} ${description}`.match(/\b(3[6-9]|4[0-6])\s?mm\b/i);
    if (!metadata.size_mm && sizeMatch) metadata.size_mm = Number(sizeMatch[1]);
  }

  return {
    name,
    description,
    category,
    estimatedValue: baseValue,
    valueRange: { low, high },
    confidence: baseValue > 10000 ? "medium" : "high",
    priceHistory,
    priceSources,
    metadata
  };
};

// ============ HELPER FUNCTIONS ============

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const getVaultForCategory = (vaults: Vault[], category: string): Vault | undefined => {
  return vaults.find(v => v.category === category);
};

const createVaultForCategory = (category: string): Vault => {
  const catInfo = CATEGORIES[category] || CATEGORIES.other;
  return {
    id: `vault-${category}-${Date.now()}`,
    name: `${catInfo.name} Collection`,
    category,
    icon: category,
    itemIds: [],
    createdAt: new Date().toISOString()
  };
};

// ============ ANALYTICS ============

const trackEvent = (event: string, data: Record<string, any> = {}) => {
  try {
    const serverUrl = window.location.hostname === "localhost" ? "" : "https://whats-it-worth.onrender.com";
    fetch(`${serverUrl}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data })
    }).catch(() => {});
  } catch {}
};

// ============ COMPONENTS ============

const ConfidenceBadge = ({ confidence }: { confidence: "low" | "medium" | "high" }) => {
  const colors = {
    low: { bg: "#FEF3C7", text: "#92400E" },
    medium: { bg: "#E0F2FE", text: "#0369A1" },
    high: { bg: "#D1FAE5", text: "#065F46" }
  };
  const c = colors[confidence];
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
      backgroundColor: c.bg, color: c.text, textTransform: "uppercase"
    }}>
      {confidence} confidence
    </span>
  );
};

 const InlineSourceLinks = ({
   sources,
   max = 3,
   linkColor,
 }: {
   sources: PriceSource[];
   max?: number;
   linkColor?: string;
 }) => {
   const uniqueSources = [] as PriceSource[];
   const seen = new Set<string>();
   for (const s of sources) {
     if (seen.has(s.name)) continue;
     uniqueSources.push(s);
     seen.add(s.name);
   }

   return (
     <>
       {uniqueSources.slice(0, max).map((source) => (
         source.url ? (
           <a
             key={source.name}
             href={source.url}
             target="_blank"
             rel="noopener noreferrer"
             style={{ color: linkColor ?? COLORS.blue, textDecoration: "none", marginLeft: 6 }}
             onClick={(e) => e.stopPropagation()}
           >
             ({source.name})
           </a>
         ) : (
           <span key={source.name} style={{ color: COLORS.textSecondary, marginLeft: 6 }}>
             ({source.name})
           </span>
         )
       ))}
     </>
   );
 };

const PriceChangeIndicator = ({ current, previous }: { current: number; previous: number }) => {
  const change = ((current - previous) / previous) * 100;
  const isUp = change >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 12, fontWeight: 600,
      color: isUp ? COLORS.primary : COLORS.red
    }}>
      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {isUp ? "+" : ""}{change.toFixed(1)}%
    </span>
  );
};

const MiniPriceChart = ({ priceHistory }: { priceHistory: PricePoint[] }) => {
  if (priceHistory.length < 2) return null;
  
  const values = priceHistory.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const width = 80;
  const height = 30;
  const points = priceHistory.map((p, i) => {
    const x = (i / (priceHistory.length - 1)) * width;
    const y = height - ((p.value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const isUp = values[values.length - 1] >= values[0];
  
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? COLORS.primary : COLORS.red}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const PhotoUploader = ({ onImageSelect, currentImage }: { 
  onImageSelect: (base64: string) => void; 
  currentImage?: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    
    // Compress and convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        let { width, height } = img;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        onImageSelect(compressed);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${isDragging ? COLORS.primary : COLORS.border}`,
        borderRadius: 16,
        padding: currentImage ? 8 : 32,
        textAlign: "center",
        cursor: "pointer",
        backgroundColor: isDragging ? COLORS.accentLight : COLORS.inputBg,
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        style={{ display: "none" }}
      />
      
      {currentImage ? (
        <div style={{ position: "relative" }}>
          <img 
            src={currentImage} 
            alt="Item" 
            style={{ 
              width: "100%", 
              maxHeight: 200, 
              objectFit: "contain",
              borderRadius: 8
            }} 
          />
          <div style={{
            position: "absolute", bottom: 8, right: 8,
            backgroundColor: "rgba(0,0,0,0.6)", color: "white",
            padding: "4px 8px", borderRadius: 6, fontSize: 11
          }}>
            <Camera size={12} style={{ marginRight: 4 }} />
            Change Photo
          </div>
        </div>
      ) : (
        <>
          <Upload size={32} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textMain, marginBottom: 4 }}>
            Drop a photo here or click to upload
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            Take a photo of your item for AI identification
          </div>
        </>
      )}
    </div>
  );
};

const ItemCard = ({ item, onClick, onDelete }: { 
  item: Item; 
  onClick: () => void;
  onDelete: () => void;
}) => {
  const lastPrice = item.priceHistory[item.priceHistory.length - 1]?.value || item.estimatedValue;
  const prevPrice = item.priceHistory[item.priceHistory.length - 2]?.value || lastPrice;

  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        transition: "transform 0.2s, box-shadow 0.2s",
        position: "relative"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(255,107,107,0.1)", border: "none",
          borderRadius: 8, padding: 6, cursor: "pointer"
        }}
      >
        <Trash2 size={14} color={COLORS.red} />
      </button>

      {item.imageData && (
        <div style={{ 
          width: "100%", height: 120, borderRadius: 12, 
          overflow: "hidden", marginBottom: 12,
          backgroundColor: COLORS.inputBg
        }}>
          <img 
            src={item.imageData} 
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textMain, marginBottom: 4 }}>
        {item.name}
      </div>
      
      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>
        {CATEGORIES[item.category]?.name || "Other"}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>
            {formatCurrency(lastPrice)}
          </div>
          <PriceChangeIndicator current={lastPrice} previous={prevPrice} />
        </div>
        <MiniPriceChart priceHistory={item.priceHistory} />
      </div>
    </div>
  );
};

const VaultCard = ({ vault, items, onClick }: { 
  vault: Vault; 
  items: Item[];
  onClick: () => void;
}) => {
  const totalValue = items.reduce((sum, item) => sum + item.estimatedValue, 0);
  const catInfo = CATEGORIES[vault.category] || CATEGORIES.other;
  const firstItemWithImage = items.find(item => item.imageData);

  return (
    <div 
      onClick={onClick}
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        transition: "transform 0.2s",
        display: "flex",
        alignItems: "center",
        gap: 14
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
    >
      {firstItemWithImage ? (
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          overflow: "hidden",
          flexShrink: 0
        }}>
          <img 
            src={firstItemWithImage.imageData} 
            alt={vault.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ) : (
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          backgroundColor: COLORS.accentLight,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: COLORS.primary,
          flexShrink: 0
        }}>
          {catInfo.icon}
        </div>
      )}
      
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textMain }}>
          {vault.name}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>
          {formatCurrency(totalValue)}
        </div>
        <ChevronRight size={16} color={COLORS.textSecondary} />
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============

export default function WhatsItWorth({ initialData }: { initialData?: any }) {
  const [appData, setAppData] = useState<AppData>(() => loadSavedData());
  const [view, setView] = useState<"dashboard" | "vault" | "item" | "add">("dashboard");
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refineBrand, setRefineBrand] = useState("");
  const [refineModel, setRefineModel] = useState("");
  const [refineVariant, setRefineVariant] = useState("");
  const [refineReference, setRefineReference] = useState("");
  const [refineSizeMm, setRefineSizeMm] = useState("");
  const [refineDialColor, setRefineDialColor] = useState("");
  const [refineBezelColor, setRefineBezelColor] = useState("");
  const [refineMaterial, setRefineMaterial] = useState("");
  const [refineYear, setRefineYear] = useState("");

  // Store metadata from ChatGPT for use when adding items
  const [hydrationMetadata] = useState<ItemMetadata>(() => {
    if (!initialData) return {};
    return {
      brand: initialData.brand || undefined,
      model: initialData.model || undefined,
      variant: initialData.variant || undefined,
      reference: initialData.reference || undefined,
      size_mm: initialData.size_mm || undefined,
      dial_color: initialData.dial_color || undefined,
      bezel_color: initialData.bezel_color || undefined,
      material: initialData.material || undefined,
      year: initialData.year || undefined,
      condition: initialData.condition || undefined,
    };
  });

  // Store ChatGPT's price estimate
  const [chatGptPricing] = useState(() => {
    if (!initialData) return null;
    if (!initialData.estimated_price) return null;
    return {
      estimatedPrice: initialData.estimated_price,
      priceLow: initialData.price_range_low || Math.floor(initialData.estimated_price * 0.85),
      priceHigh: initialData.price_range_high || Math.floor(initialData.estimated_price * 1.15),
      confidence: initialData.confidence || "medium",
    };
  });
  
  // Add item form state - pre-fill from ChatGPT data
  const [newItemName, setNewItemName] = useState(() => {
    if (!initialData) return "";
    // Build a sensible default name from ChatGPT data
    const parts = [initialData.brand, initialData.model, initialData.variant].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : (initialData.item_name || "");
  });
  const [newItemDescription, setNewItemDescription] = useState(() => {
    return initialData?.item_description || "";
  });
  const [newItemImage, setNewItemImage] = useState<string | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // UI state
  const [showBanner, setShowBanner] = useState(() => {
    try {
      const d = localStorage.getItem(BANNER_STORAGE_KEY);
      return !d || (new Date().getTime() - parseInt(d)) > 86400000;
    } catch { return true; }
  });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  // Save data on change
  useEffect(() => {
    saveData(appData);
  }, [appData]);

  useEffect(() => {
    setAppData((prev) => {
      const nextItems = prev.items.map(ensureItemPriceSources);
      const changed = nextItems.some((it, idx) => it !== prev.items[idx]);
      return changed ? { ...prev, items: nextItems } : prev;
    });
  }, []);

  // Auto-hydration: Create item and navigate to it when initialData has specific info
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    if (hasHydrated) return;
    if (!initialData) return;
    
    // Check if we have enough specific information to auto-create an item
    // Need at least brand+model, or a specific item_name with pricing
    const hasBrandModel = initialData.brand && initialData.model;
    const hasSpecificItem = initialData.item_name && initialData.estimated_price;
    const hasEnoughInfo = hasBrandModel || hasSpecificItem;
    
    if (!hasEnoughInfo) {
      console.log("[Hydration] Not enough specific info to auto-create item, showing dashboard");
      setHasHydrated(true);
      return;
    }

    console.log("[Hydration] Auto-creating item from initialData:", initialData);
    setHasHydrated(true);

    // Build item name from available data
    const itemName = [initialData.brand, initialData.model, initialData.variant]
      .filter(Boolean)
      .join(" ") || initialData.item_name || "Unknown Item";

    // Determine category
    const category = initialData.category || detectCategory(itemName + " " + (initialData.item_description || ""));

    // Build metadata
    const metadata: ItemMetadata = {
      brand: initialData.brand,
      model: initialData.model,
      variant: initialData.variant,
      reference: initialData.reference,
      size_mm: initialData.size_mm,
      dial_color: initialData.dial_color,
      bezel_color: initialData.bezel_color,
      material: initialData.material,
      year: initialData.year,
      condition: initialData.condition,
    };

    // Use ChatGPT's price estimate or generate mock valuation
    const mockValuation = generateMockValuation(itemName, initialData.item_description || "", category);
    const estimatedValue = initialData.estimated_price || mockValuation.estimatedValue;
    const valueRange = initialData.estimated_price
      ? {
          low: initialData.price_range_low || Math.floor(initialData.estimated_price * 0.85),
          high: initialData.price_range_high || Math.floor(initialData.estimated_price * 1.15),
        }
      : mockValuation.valueRange;
    const confidence = (initialData.confidence || mockValuation.confidence) as "low" | "medium" | "high";

    // Create the item
    const newItem: Item = ensureItemPriceSources({
      id: `item-${Date.now()}`,
      name: itemName,
      description: initialData.item_description || `${itemName} - ${initialData.condition || "good"} condition`,
      category,
      estimatedValue,
      valueRange,
      confidence,
      metadata,
      priceSources: [],
      priceHistory: [{ date: new Date().toISOString().split("T")[0], value: estimatedValue }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Find or create vault for this category
    setAppData((prev) => {
      let vault = getVaultForCategory(prev.vaults, category);
      let updatedVaults = [...prev.vaults];

      if (!vault) {
        vault = createVaultForCategory(category);
        updatedVaults.push(vault);
      }

      // Add item to vault
      const vaultIndex = updatedVaults.findIndex((v) => v.id === vault!.id);
      updatedVaults[vaultIndex] = {
        ...updatedVaults[vaultIndex],
        itemIds: [...updatedVaults[vaultIndex].itemIds, newItem.id],
      };

      return {
        ...prev,
        items: [...prev.items, newItem],
        vaults: updatedVaults,
      };
    });

    // Navigate to show the new item
    setSelectedItemId(newItem.id);
    setView("item");

    trackEvent("hydration_auto_create", { 
      category, 
      value: estimatedValue,
      hasBrandModel: !!hasBrandModel,
      hasPrice: !!initialData.estimated_price 
    });
  }, [initialData, hasHydrated]);

  // Calculate totals
  const totalPortfolioValue = useMemo(() => {
    return appData.items.reduce((sum, item) => sum + item.estimatedValue, 0);
  }, [appData.items]);

  const portfolioPriceChange = useMemo(() => {
    if (appData.items.length === 0) return 0;
    const currentTotal = appData.items.reduce((sum, item) => {
      const last = item.priceHistory[item.priceHistory.length - 1];
      return sum + (last?.value || item.estimatedValue);
    }, 0);
    const previousTotal = appData.items.reduce((sum, item) => {
      const prev = item.priceHistory[item.priceHistory.length - 2];
      const last = item.priceHistory[item.priceHistory.length - 1];
      return sum + (prev?.value || last?.value || item.estimatedValue);
    }, 0);
    return previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  }, [appData.items]);

  // Get items for a vault
  const getVaultItems = useCallback((vault: Vault): Item[] => {
    return vault.itemIds.map(id => appData.items.find(i => i.id === id)).filter(Boolean) as Item[];
  }, [appData.items]);

  // Add new item
  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    
    setIsAnalyzing(true);
    trackEvent("add_item_start", { hasImage: !!newItemImage });

    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const category = initialData?.category || detectCategory(newItemName + " " + newItemDescription);
    const valuation = generateMockValuation(newItemName, newItemDescription, category);

    // Use ChatGPT's price estimate if available, otherwise fall back to mock valuation
    const finalEstimatedValue = chatGptPricing?.estimatedPrice || valuation.estimatedValue;
    const finalValueRange = chatGptPricing 
      ? { low: chatGptPricing.priceLow, high: chatGptPricing.priceHigh }
      : valuation.valueRange;
    const finalConfidence = (chatGptPricing?.confidence || valuation.confidence) as "low" | "medium" | "high";

    // Merge ChatGPT metadata with any inferred metadata
    const mergedMetadata: ItemMetadata = {
      ...valuation.metadata,
      ...hydrationMetadata,
    };
    
    const newItem: Item = ensureItemPriceSources({
      id: `item-${Date.now()}`,
      ...valuation,
      estimatedValue: finalEstimatedValue,
      valueRange: finalValueRange,
      confidence: finalConfidence,
      metadata: mergedMetadata,
      imageData: newItemImage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Find or create vault for this category
    let vault = getVaultForCategory(appData.vaults, category);
    let updatedVaults = [...appData.vaults];
    
    if (!vault) {
      vault = createVaultForCategory(category);
      updatedVaults.push(vault);
    }
    
    // Add item to vault
    const vaultIndex = updatedVaults.findIndex(v => v.id === vault!.id);
    updatedVaults[vaultIndex] = {
      ...updatedVaults[vaultIndex],
      itemIds: [...updatedVaults[vaultIndex].itemIds, newItem.id]
    };

    setAppData(prev => ({
      ...prev,
      items: [...prev.items, newItem],
      vaults: updatedVaults
    }));

    // Reset form and go to item view
    setNewItemName("");
    setNewItemDescription("");
    setNewItemImage(undefined);
    setIsAnalyzing(false);
    setSelectedItemId(newItem.id);
    setView("item");

    trackEvent("add_item_complete", { category, value: newItem.estimatedValue });
  };

  // Delete item
  const handleDeleteItem = (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    setAppData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
      vaults: prev.vaults.map(v => ({
        ...v,
        itemIds: v.itemIds.filter(id => id !== itemId)
      })).filter(v => v.itemIds.length > 0) // Remove empty vaults
    }));

    if (selectedItemId === itemId) {
      setView("dashboard");
      setSelectedItemId(null);
    }

    trackEvent("delete_item");
  };

  // Refresh prices (simulate daily update)
  const handleRefreshPrices = () => {
    setAppData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        const lastPrice = item.priceHistory[item.priceHistory.length - 1]?.value || item.estimatedValue;
        const fluctuation = 1 + (Math.random() - 0.5) * 0.1;
        const newPrice = Math.floor(lastPrice * fluctuation);
        
        return {
          ...item,
          estimatedValue: newPrice,
          priceHistory: [
            ...item.priceHistory,
            { date: new Date().toISOString().split("T")[0], value: newPrice }
          ].slice(-30), // Keep last 30 days
          updatedAt: new Date().toISOString()
        };
      }),
      lastPriceUpdate: new Date().toISOString()
    }));

    trackEvent("refresh_prices");
  };

  // Reset all data
  const handleReset = () => {
    if (!confirm("Are you sure you want to reset all data? This will delete all your items and vaults. This cannot be undone.")) return;
    resetAllData();
    setAppData(DEFAULT_DATA);
    setView("dashboard");
    setSelectedVaultId(null);
    setSelectedItemId(null);
    setShowBanner(true);
    trackEvent("reset_data");
  };

  // Open donate link
  const handleDonate = () => {
    window.open("https://buymeacoffee.com/jonteplitsky", "_blank");
    trackEvent("donate_click");
  };

  // Handle feedback submit
  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackStatus("submitting");
    try {
      const serverUrl = window.location.hostname === "localhost" ? "" : "https://whats-it-worth.onrender.com";
      const response = await fetch(`${serverUrl}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "user_feedback", data: { feedback: feedbackText, source: "whats-it-worth" } })
      });
      if (response.ok) {
        setFeedbackStatus("success");
        setTimeout(() => { setShowFeedbackModal(false); setFeedbackText(""); setFeedbackStatus("idle"); }, 2000);
      } else {
        setFeedbackStatus("error");
      }
    } catch {
      setFeedbackStatus("error");
    }
  };

  // Get selected vault and item
  const selectedVault = selectedVaultId ? appData.vaults.find(v => v.id === selectedVaultId) : null;
  const selectedItem = selectedItemId ? appData.items.find(i => i.id === selectedItemId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!selectedItem) return;
    if (selectedItem.category !== "watches") return;
    if (!selectedItem.imageData) return;

    const m = selectedItem.metadata || {};
    if (m.dial_color && m.bezel_color) return;

    inferWatchColorsFromImageData(selectedItem.imageData).then((colors) => {
      if (cancelled) return;
      if (!colors.dial_color && !colors.bezel_color) return;

      const nextMeta: ItemMetadata = {
        ...m,
        dial_color: m.dial_color ?? colors.dial_color,
        bezel_color: m.bezel_color ?? colors.bezel_color,
      };

      const nextItem = ensureItemPriceSources({
        ...selectedItem,
        metadata: nextMeta,
        updatedAt: new Date().toISOString(),
      });

      setAppData((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === nextItem.id ? nextItem : it)),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [selectedItemId]);

  const openRefineModal = useCallback(() => {
    if (!selectedItem) return;
    const m = selectedItem.metadata || {};
    setRefineBrand(m.brand || "");
    setRefineModel(m.model || "");
    setRefineVariant(m.variant || "");
    setRefineReference(m.reference || "");
    setRefineSizeMm(typeof m.size_mm === "number" ? String(m.size_mm) : "");
    setRefineDialColor(m.dial_color || "");
    setRefineBezelColor(m.bezel_color || "");
    setRefineMaterial(m.material || "");
    setRefineYear(typeof m.year === "number" ? String(m.year) : "");
    setShowRefineModal(true);

    if (
      selectedItem.category === "watches" &&
      selectedItem.imageData &&
      (!m.dial_color || !m.bezel_color)
    ) {
      inferWatchColorsFromImageData(selectedItem.imageData).then((colors) => {
        if (!m.dial_color && colors.dial_color) setRefineDialColor(colors.dial_color);
        if (!m.bezel_color && colors.bezel_color) setRefineBezelColor(colors.bezel_color);
      });
    }
  }, [selectedItem]);

  const applyRefine = useCallback(() => {
    if (!selectedItem) return;

    const sizeMm = Number(refineSizeMm);
    const year = Number(refineYear);
    const nextMetadata: ItemMetadata = {
      ...selectedItem.metadata,
      brand: refineBrand.trim() || undefined,
      model: refineModel.trim() || undefined,
      variant: refineVariant.trim() || undefined,
      reference: refineReference.trim() || undefined,
      size_mm: Number.isFinite(sizeMm) ? sizeMm : undefined,
      dial_color: refineDialColor.trim() || undefined,
      bezel_color: refineBezelColor.trim() || undefined,
      material: refineMaterial.trim() || undefined,
      year: Number.isFinite(year) ? year : undefined,
    };

    const updated: Item = ensureItemPriceSources({
      ...selectedItem,
      metadata: nextMetadata,
      updatedAt: new Date().toISOString(),
    });

    setAppData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === updated.id ? updated : it)),
    }));
    setShowRefineModal(false);
  }, [
    selectedItem,
    refineBrand,
    refineModel,
    refineVariant,
    refineReference,
    refineSizeMm,
    refineDialColor,
    refineBezelColor,
    refineMaterial,
    refineYear,
  ]);

  const styles = {
    container: { 
      width: "100%", maxWidth: 600, margin: "0 auto", 
      backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif", 
      padding: 20, boxSizing: "border-box" as const
    },
    card: { 
      backgroundColor: COLORS.card, borderRadius: 20, padding: 20, 
      boxShadow: "0 4px 12px rgba(0,0,0,0.06)", marginBottom: 16 
    },
    input: {
      width: "100%", padding: "14px 16px", borderRadius: 12,
      border: `1px solid ${COLORS.border}`, fontSize: 15,
      backgroundColor: COLORS.inputBg, color: COLORS.textMain,
      boxSizing: "border-box" as const, outline: "none"
    },
    footer: { 
      display: "flex", justifyContent: "center", gap: 24, 
      marginTop: 40, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` 
    },
    footerBtn: { 
      display: "flex", alignItems: "center", gap: 8, 
      background: "none", border: "none", cursor: "pointer", 
      color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, padding: 8 
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.textMain, marginBottom: 4 }}>
          The Collector's Valuation Engine
        </div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} color={COLORS.primary} />
          Powered by real-time market data & AI analysis
        </div>
      </div>

      {/* Banner */}
      {showBanner && view === "dashboard" && (
        <div style={{ 
          backgroundColor: COLORS.accentLight, borderRadius: 16, padding: 16, marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative"
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.primaryDark, paddingRight: 24 }}>
            📸 Upload photos of your collectibles to get instant valuations!
          </div>
          <button
            onClick={() => {
              setShowBanner(false);
              localStorage.setItem(BANNER_STORAGE_KEY, Date.now().toString());
            }}
            style={{ 
              position: "absolute", top: 8, right: 8,
              background: "none", border: "none", cursor: "pointer", padding: 4 
            }}
          >
            <X size={16} color={COLORS.textSecondary} />
          </button>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === "dashboard" && (
        <>
          {/* Portfolio Summary */}
          <div style={{
            ...styles.card,
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
            color: "white"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 2 }}>
                  Total Portfolio Value
                </div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>
                  {formatCurrency(totalPortfolioValue)}
                </div>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                backgroundColor: "rgba(255,255,255,0.25)", padding: "5px 10px", borderRadius: 14,
                fontSize: 14, fontWeight: 700
              }}>
                {portfolioPriceChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {portfolioPriceChange >= 0 ? "+" : ""}{portfolioPriceChange.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              <span>{appData.items.length} items in {appData.vaults.length} vaults</span>
              <span>Refreshed {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginBottom: 20, display: "flex", gap: 12 }}>
            <button
              onClick={() => setView("add")}
              style={{
                flex: 1, padding: 14, borderRadius: 16, border: "none",
                backgroundColor: COLORS.primary, color: "white",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 12px rgba(86,197,150,0.3)"
              }}
            >
              <Plus size={20} /> Add Manually
            </button>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e: any) => {
                  const file = e.target?.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setNewItemImage(event.target?.result as string);
                      setView("add");
                    };
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
              style={{
                flex: 1, padding: 14, borderRadius: 16, border: `2px solid ${COLORS.primary}`,
                backgroundColor: "white", color: COLORS.primary,
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Camera size={20} /> Upload Photo
            </button>
          </div>

          {/* Vaults */}
          {appData.vaults.length > 0 ? (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textMain, marginBottom: 12 }}>
                Your Vaults
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {appData.vaults.map(vault => (
                  <VaultCard
                    key={vault.id}
                    vault={vault}
                    items={getVaultItems(vault)}
                    onClick={() => {
                      setSelectedVaultId(vault.id);
                      setView("vault");
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ ...styles.card, textAlign: "center", padding: 48 }}>
              <Package size={48} color={COLORS.textSecondary} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textMain, marginBottom: 8 }}>
                No Items Yet
              </div>
              <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 }}>
                Add your first item to start tracking its value
              </div>
              <button
                onClick={() => setView("add")}
                style={{
                  padding: "12px 24px", borderRadius: 12, border: "none",
                  backgroundColor: COLORS.primary, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer"
                }}
              >
                <Plus size={16} style={{ marginRight: 8 }} />
                Add Your First Item
              </button>
            </div>
          )}
        </>
      )}

      {/* VAULT VIEW */}
      {view === "vault" && selectedVault && (
        <>
          <button
            onClick={() => { setView("dashboard"); setSelectedVaultId(null); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 14, fontWeight: 600, color: COLORS.textSecondary,
              marginBottom: 16, padding: 0
            }}
          >
            <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} />
            Back to Dashboard
          </button>

          <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: COLORS.accentLight,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: COLORS.primary
            }}>
              {CATEGORIES[selectedVault.category]?.icon || <Box size={28} />}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textMain }}>
                {selectedVault.name}
              </div>
              <div style={{ fontSize: 14, color: COLORS.textSecondary }}>
                {getVaultItems(selectedVault).length} items • Total: {formatCurrency(
                  getVaultItems(selectedVault).reduce((sum, i) => sum + i.estimatedValue, 0)
                )}
              </div>
            </div>
          </div>

          <div style={{ 
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 16 
          }}>
            {getVaultItems(selectedVault).map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setView("item");
                }}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </div>

          <button
            onClick={() => setView("add")}
            style={{
              width: "100%", marginTop: 16, padding: 16, borderRadius: 16,
              border: `2px dashed ${COLORS.border}`,
              backgroundColor: "transparent", color: COLORS.textSecondary,
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            <Plus size={18} /> Add Another Item
          </button>
        </>
      )}

      {/* ITEM DETAIL VIEW */}
      {view === "item" && selectedItem && (
        <>
          <button
            onClick={() => {
              if (selectedVaultId) {
                setView("vault");
              } else {
                setView("dashboard");
              }
              setSelectedItemId(null);
            }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 14, fontWeight: 600, color: COLORS.textSecondary,
              marginBottom: 16, padding: 0
            }}
          >
            <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} />
            Back
          </button>

          {selectedItem.imageData && (
            <div style={{ 
              borderRadius: 20, overflow: "hidden", marginBottom: 16,
              backgroundColor: COLORS.inputBg
            }}>
              <img 
                src={selectedItem.imageData} 
                alt={selectedItem.name}
                style={{ width: "100%", maxHeight: 300, objectFit: "contain" }}
              />
            </div>
          )}

          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                  {CATEGORIES[selectedItem.category]?.name || "Other"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textMain, marginBottom: 8 }}>
                  {selectedItem.name}
                </div>
                {selectedItem.description && (
                  <div style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
                    {selectedItem.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteItem(selectedItem.id)}
                style={{
                  background: "rgba(255,107,107,0.1)", border: "none",
                  borderRadius: 8, padding: 8, cursor: "pointer"
                }}
              >
                <Trash2 size={16} color={COLORS.red} />
              </button>
            </div>

            <div style={{ 
              backgroundColor: COLORS.accentLight, borderRadius: 16, padding: 20, marginTop: 16 
            }}>
              <div style={{ fontSize: 12, color: COLORS.primaryDark, marginBottom: 4 }}>
                Estimated Value
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.primary, marginBottom: 8 }}>
                {formatCurrency(selectedItem.estimatedValue)}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                    Range: {formatCurrency(selectedItem.valueRange.low)} - {formatCurrency(selectedItem.valueRange.high)}
                  </span>
                  {selectedItem.priceSources && selectedItem.priceSources.length > 0 && (
                    <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
                      <InlineSourceLinks sources={selectedItem.priceSources} max={3} />
                    </div>
                  )}
                </div>
                <ConfidenceBadge confidence={selectedItem.confidence} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                onClick={openRefineModal}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.card,
                  color: COLORS.textMain,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Refine your price
              </button>
            </div>

            {/* Price History Chart */}
            {selectedItem.priceHistory.length > 1 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textMain, marginBottom: 12 }}>
                  Price History (30 Days)
                </div>
                <div style={{ 
                  height: 120, backgroundColor: COLORS.inputBg, borderRadius: 12, 
                  padding: 16, position: "relative" 
                }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {(() => {
                      const values = selectedItem.priceHistory.map(p => p.value);
                      const min = Math.min(...values) * 0.95;
                      const max = Math.max(...values) * 1.05;
                      const range = max - min || 1;
                      
                      const points = selectedItem.priceHistory.map((p, i) => {
                        const x = (i / (selectedItem.priceHistory.length - 1)) * 100;
                        const y = 100 - ((p.value - min) / range) * 100;
                        return `${x},${y}`;
                      }).join(" ");

                      return (
                        <>
                          <defs>
                            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <polygon 
                            points={`0,100 ${points} 100,100`}
                            fill="url(#chartGradient)"
                          />
                          <polyline
                            points={points}
                            fill="none"
                            stroke={COLORS.primary}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <div style={{ 
                  display: "flex", justifyContent: "space-between", 
                  fontSize: 11, color: COLORS.textSecondary, marginTop: 8 
                }}>
                  <span>{selectedItem.priceHistory[0]?.date}</span>
                  <span>{selectedItem.priceHistory[selectedItem.priceHistory.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {showRefineModal && (
              <div
                onClick={() => setShowRefineModal(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  zIndex: 9999,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    backgroundColor: COLORS.card,
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.textMain }}>Refine your price</div>
                    <button
                      onClick={() => setShowRefineModal(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <X size={18} color={COLORS.textSecondary} />
                    </button>
                  </div>

                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 1.4 }}>
                    Add any details you know (especially model and reference number). This will improve the accuracy of the marketplace search links.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input placeholder="Brand (e.g. Omega)" value={refineBrand} onChange={(e) => setRefineBrand(e.target.value)} style={styles.input} />
                    <input placeholder="Model (e.g. Seamaster)" value={refineModel} onChange={(e) => setRefineModel(e.target.value)} style={styles.input} />
                    <input placeholder="Variant (e.g. Diver 300M)" value={refineVariant} onChange={(e) => setRefineVariant(e.target.value)} style={styles.input} />
                    <input placeholder="Reference (e.g. 210.30.42.20.03.001)" value={refineReference} onChange={(e) => setRefineReference(e.target.value)} style={styles.input} />
                    <input placeholder="Size mm (e.g. 42)" value={refineSizeMm} onChange={(e) => setRefineSizeMm(e.target.value)} style={styles.input} />
                    <input placeholder="Year (e.g. 2019)" value={refineYear} onChange={(e) => setRefineYear(e.target.value)} style={styles.input} />
                    <input placeholder="Dial color (e.g. blue)" value={refineDialColor} onChange={(e) => setRefineDialColor(e.target.value)} style={styles.input} />
                    <input placeholder="Bezel color (e.g. blue)" value={refineBezelColor} onChange={(e) => setRefineBezelColor(e.target.value)} style={styles.input} />
                    <input placeholder="Material (e.g. stainless steel)" value={refineMaterial} onChange={(e) => setRefineMaterial(e.target.value)} style={styles.input} />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      onClick={() => setShowRefineModal(false)}
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `1px solid ${COLORS.border}`,
                        backgroundColor: COLORS.card,
                        color: COLORS.textMain,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyRefine}
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "none",
                        backgroundColor: COLORS.primary,
                        color: "white",
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Update links
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            {Object.keys(selectedItem.metadata).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textMain, marginBottom: 12 }}>
                  Item Details
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedItem.metadata.brand && (
                    <span style={{ 
                      fontSize: 12, padding: "6px 12px", borderRadius: 8,
                      backgroundColor: COLORS.inputBg, color: COLORS.textMain
                    }}>
                      Brand: {selectedItem.metadata.brand}
                    </span>
                  )}
                  {selectedItem.metadata.year && (
                    <span style={{ 
                      fontSize: 12, padding: "6px 12px", borderRadius: 8,
                      backgroundColor: COLORS.inputBg, color: COLORS.textMain
                    }}>
                      Year: {selectedItem.metadata.year}
                    </span>
                  )}
                  {selectedItem.metadata.condition && (
                    <span style={{ 
                      fontSize: 12, padding: "6px 12px", borderRadius: 8,
                      backgroundColor: COLORS.inputBg, color: COLORS.textMain,
                      textTransform: "capitalize"
                    }}>
                      Condition: {selectedItem.metadata.condition}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ADD ITEM VIEW */}
      {view === "add" && (
        <>
          <button
            onClick={() => setView("dashboard")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 14, fontWeight: 600, color: COLORS.textSecondary,
              marginBottom: 16, padding: 0
            }}
          >
            <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} />
            Cancel
          </button>

          <div style={styles.card}>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textMain, marginBottom: 20 }}>
              Add New Item
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: COLORS.textMain }}>
                Photo (Optional)
              </label>
              <PhotoUploader 
                onImageSelect={setNewItemImage} 
                currentImage={newItemImage}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: COLORS.textMain }}>
                Item Name *
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Rolex Submariner, 1967 Mustang"
                style={styles.input}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: COLORS.textMain }}>
                Description
              </label>
              <textarea
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                placeholder="Describe condition, year, model, any unique features..."
                rows={3}
                style={{ ...styles.input, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <button
              onClick={handleAddItem}
              disabled={!newItemName.trim() || isAnalyzing}
              style={{
                width: "100%", padding: 16, borderRadius: 16, border: "none",
                backgroundColor: newItemName.trim() && !isAnalyzing ? COLORS.primary : COLORS.border,
                color: "white", fontSize: 16, fontWeight: 700,
                cursor: newItemName.trim() && !isAnalyzing ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={18} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Get Valuation
                </>
              )}
            </button>
          </div>

          <div style={{ 
            backgroundColor: COLORS.orangeLight, borderRadius: 16, padding: 16, marginTop: 16,
            display: "flex", gap: 12, alignItems: "flex-start" 
          }}>
            <Info size={18} color={COLORS.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: COLORS.orange, lineHeight: 1.5 }}>
              <strong>Tip:</strong> Include brand, model, year, and condition for more accurate valuations. 
              Photos help our AI identify items more precisely.
            </div>
          </div>
        </>
      )}

      {/* Disclaimer */}
      {view === "dashboard" && appData.items.length > 0 && (
        <div style={{ 
          backgroundColor: COLORS.orangeLight, borderRadius: 16, padding: 16, marginTop: 24,
          display: "flex", gap: 12, alignItems: "flex-start" 
        }}>
          <Info size={18} color={COLORS.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: COLORS.orange, lineHeight: 1.5 }}>
            <strong>Disclaimer:</strong> Valuations are estimates based on market data and AI analysis. 
            Actual values may vary. For high-value items, we recommend professional appraisal.
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer} className="no-print">
        <button style={styles.footerBtn} onClick={handleReset}>
          <RotateCcw size={16} /> Reset
        </button>
        <button style={styles.footerBtn} onClick={handleDonate}>
          <Heart size={16} /> Donate
        </button>
        <button style={styles.footerBtn} onClick={() => setShowFeedbackModal(true)}>
          <MessageSquare size={16} /> Feedback
        </button>
        <button style={styles.footerBtn} onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "flex-start", justifyContent: "center", paddingTop: 40, zIndex: 1000
        }} onClick={() => setShowFeedbackModal(false)}>
          <div style={{
            backgroundColor: "white", borderRadius: 20, padding: 24,
            width: "90%", maxWidth: 400
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Feedback</h3>
              <button onClick={() => setShowFeedbackModal(false)} style={{
                background: "none", border: "none", cursor: "pointer", padding: 4
              }}>
                <X size={20} color={COLORS.textSecondary} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 }}>
              Help us improve What's It Worth.
            </p>
            {feedbackStatus === "success" ? (
              <div style={{ textAlign: "center", padding: 20, color: COLORS.primary, fontWeight: 600 }}>
                Thanks for your feedback!
              </div>
            ) : (
              <>
                <textarea
                  style={{ ...styles.input, height: 120, resize: "none", fontFamily: "inherit" }}
                  placeholder="Tell us what you think..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
                {feedbackStatus === "error" && (
                  <div style={{ color: COLORS.red, fontSize: 14, marginTop: 8 }}>
                    Failed to send. Please try again.
                  </div>
                )}
                <button
                  style={{
                    width: "100%", marginTop: 12, padding: "14px 16px", borderRadius: 12,
                    border: "none",
                    backgroundColor: feedbackText.trim() ? COLORS.primary : COLORS.border,
                    color: "white", fontSize: 14, fontWeight: 600,
                    cursor: feedbackText.trim() ? "pointer" : "not-allowed"
                  }}
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackStatus === "submitting" || !feedbackText.trim()}
                >
                  {feedbackStatus === "submitting" ? "Sending..." : "Send Feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
