/**
 * StoreFlow by Flywheel — Industry & Product Category Taxonomy
 * 
 * Provides industry-specific presets and tailored product categories
 * for merchant onboarding and dynamic inventory management.
 */

export const BUSINESS_INDUSTRIES = [
  {
    id: "auto_parts",
    name: "Auto & Motor Spare Parts",
    icon: "🚗",
    badge: "Automotive",
    description: "Car, truck, motorcycle replacement parts, lubricants & mechanical tools",
    categories: [
      "Engine & Mechanical Parts",
      "Cooling & Radiator Systems",
      "Electrical & Ignition",
      "Brakes & Suspension",
      "Transmission & Drivetrain",
      "Body Parts & Panels",
      "Filters (Oil, Air, Fuel)",
      "Lubricants & Engine Oils",
      "Tires, Rims & Wheels",
      "Batteries & Lighting",
      "Tools & Garage Equipment",
      "Car Accessories & Care"
    ]
  },
  {
    id: "hardware_building",
    name: "Hardware & Building Materials",
    icon: "🔨",
    badge: "Construction",
    description: "Cement, iron rods, roofing, plumbing, electricals & construction tools",
    categories: [
      "Cement, Sand & Aggregates",
      "Iron Rods & Structural Steel",
      "Roofing Sheets & Trusses",
      "Plumbing Pipes & Fittings",
      "Electrical Cables & Conduits",
      "Lighting & Switches",
      "Paints, Primers & Finishes",
      "Hand Tools & Power Tools",
      "Tiles, Flooring & Adhesives",
      "Doors, Locks & Handles",
      "Screws, Nails & Fasteners",
      "Safety Gear & PPE"
    ]
  },
  {
    id: "clothing_fashion",
    name: "Fashion, Clothing & Boutique",
    icon: "👗",
    badge: "Apparel",
    description: "Apparel, footwear, bags, African fabrics, jewelry & fashion accessories",
    categories: [
      "Men's Clothing",
      "Women's Clothing",
      "Children & Baby Wear",
      "Shoes, Sneakers & Sandals",
      "Bags, Purses & Luggage",
      "Jewelry & Watches",
      "African Prints & Textiles",
      "Undergarments & Nightwear",
      "Caps, Hats & Belts",
      "Perfumes & Fragrances"
    ]
  },
  {
    id: "electronics_gadgets",
    name: "Electronics, Phones & Appliances",
    icon: "📱",
    badge: "Tech & Home",
    description: "Smartphones, laptops, home entertainment, accessories & appliances",
    categories: [
      "Smartphones & Cell Phones",
      "Phone Cases & Screen Protectors",
      "Chargers, Cables & Power Banks",
      "Audio, Speakers & Earphones",
      "Laptops, Computers & Tablets",
      "Television & Home Theater",
      "Kitchen Appliances & Blenders",
      "Refrigerators & Freezers",
      "Computer Peripherals & Storage",
      "Smartwatches & Wearables"
    ]
  },
  {
    id: "supermarket_grocery",
    name: "Supermarket, Grocery & Provisions",
    icon: "🛒",
    badge: "FMCG",
    description: "Foodstuffs, beverages, toiletries, packaged foods & household consumables",
    categories: [
      "Food Staples (Rice, Oil, Flour, Sugar)",
      "Canned & Packaged Foods",
      "Beverages, Soft Drinks & Juices",
      "Alcoholic Beverages & Beers",
      "Dairy, Milk & Eggs",
      "Bakery & Confectionery",
      "Snacks, Cookies & Chocolates",
      "Toiletries & Soaps",
      "Household & Cleaning Detergents",
      "Frozen Foods & Poultry",
      "Baby Foods & Diapers"
    ]
  },
  {
    id: "pharmacy_health",
    name: "Pharmacy, Drugstore & Healthcare",
    icon: "💊",
    badge: "Healthcare",
    description: "Prescription medications, OTC drugs, vitamins & healthcare supplies",
    categories: [
      "Prescription Medicines (Rx)",
      "Over-The-Counter (OTC) Drugs",
      "Vitamins & Dietary Supplements",
      "First Aid & Bandages",
      "Baby & Maternal Healthcare",
      "Personal Hygiene & Sanitation",
      "Medical Diagnostic Devices",
      "Herbal & Natural Health"
    ]
  },
  {
    id: "beauty_cosmetics",
    name: "Beauty, Cosmetics & Salon Supplies",
    icon: "💄",
    badge: "Beauty",
    description: "Skincare, wigs, haircare, makeup, nail care & salon products",
    categories: [
      "Wigs, Weaves & Hair Extensions",
      "Hair Creams, Shampoos & Oils",
      "Skincare Lotions & Serums",
      "Makeup & Color Cosmetics",
      "Nail Care & Polish",
      "Deodorants & Perfumes",
      "Salon Professional Equipment",
      "Body Washes & Soaps"
    ]
  },
  {
    id: "agriculture_farming",
    name: "Agro-Chemicals & Animal Feed",
    icon: "🌾",
    badge: "Agriculture",
    description: "Fertilizers, crop protection, seeds, poultry feeds & veterinary items",
    categories: [
      "Fertilizers & Soil Nutrients",
      "Pesticides & Insecticides",
      "Weedicides & Herbicides",
      "Seeds & Planting Material",
      "Poultry Feed & Concentrates",
      "Fish Feed & Livestock Feeds",
      "Veterinary Drugs & Vaccines",
      "Sprayers & Farm Implements"
    ]
  },
  {
    id: "household_plastics",
    name: "Plastics, Utensils & Kitchenware",
    icon: "🍽️",
    badge: "Home & Plastic",
    description: "Plastic containers, basins, pots, cookware & dining utensils",
    categories: [
      "Plastic Basins & Buckets",
      "Food Storage Containers & Coolers",
      "Cookware (Pots, Pans & Cauldrons)",
      "Dinnerware (Plates, Bowls & Cups)",
      "Cutlery & Kitchen Utensils",
      "Cleaning Brooms, Mops & Dustbins",
      "Disposable Party Packs & Cups"
    ]
  },
  {
    id: "general_retail",
    name: "General Retail & Wholesale",
    icon: "🏪",
    badge: "General",
    description: "General merchandise, FMCG products & mixed retail inventory",
    categories: [
      "General Provisions",
      "Packaged Goods",
      "Household Consumables",
      "Beverages & Drinks",
      "Miscellaneous Items"
    ]
  }
];

/**
 * Returns tailored categories for a specific industry id or fallback to general retail
 */
export const getIndustryCategories = (industryId) => {
  if (!industryId) {
    return BUSINESS_INDUSTRIES.find(i => i.id === 'general_retail').categories;
  }
  const found = BUSINESS_INDUSTRIES.find(
    i => i.id === industryId || i.name.toLowerCase() === industryId.toLowerCase()
  );
  return found ? found.categories : BUSINESS_INDUSTRIES.find(i => i.id === 'general_retail').categories;
};

/**
 * Returns metadata info for a specific industry id
 */
export const getIndustryInfo = (industryId) => {
  if (!industryId) {
    return BUSINESS_INDUSTRIES.find(i => i.id === 'general_retail');
  }
  return BUSINESS_INDUSTRIES.find(
    i => i.id === industryId || i.name.toLowerCase() === industryId.toLowerCase()
  ) || BUSINESS_INDUSTRIES.find(i => i.id === 'general_retail');
};
