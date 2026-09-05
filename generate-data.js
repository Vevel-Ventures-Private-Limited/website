// ================================================================
//  build-data.js – Generate all data files for Vevel Ventures
//  Run: node build-data.js
// ================================================================

const fs = require('fs');
const path = require('path');

// 1. READ PRODUCT DATA
let products;
try {
    const raw = fs.readFileSync('products.json', 'utf8');
    products = JSON.parse(raw);
    console.log(`✅ Loaded ${products.length} products`);
} catch (e) {
    console.error('❌ products.json not found!');
    process.exit(1);
}

// 2. HELPERS
function getMainCategory(p) {
    const path = p.categoryPath || p.category || '';
    const parts = path.split('→').map(s => s.trim());
    return parts[0] || 'Uncategorized';
}

function getSubCategory(p) {
    const path = p.categoryPath || p.category || '';
    const parts = path.split('→').map(s => s.trim());
    return parts[parts.length - 1] || '';
}

function getFamily(name) {
    const match = name.match(/^[A-Z]+/);
    return match ? match[0] : name;
}

// ================================================================
//  EXTRACT KEY SPECIFICATIONS
// ================================================================
function extractKeySpecs(p) {
    const specs = {};

    // First, check if keySpecifications already has data
    if (p.keySpecifications && Object.keys(p.keySpecifications).length > 0) {
        Object.assign(specs, p.keySpecifications);
    }

    // Parse from description
    if (p.description) {
        const lines = p.description.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes(':')) {
                const [key, ...valParts] = trimmed.split(':').map(s => s.trim());
                const importantKeys = ['Gross Volume', 'Capacity', 'Temperature', 'Shelves', 'Baskets', 'Star', 'Energy', 'Dimensions', 'Volume', 'Litres', 'Liters', 'Ice Shape', 'Production', 'Storage'];
                if (importantKeys.some(k => key.includes(k)) && !specs[key]) {
                    specs[key] = valParts.join(':').trim();
                }
            }
        }
    }

    // Ensure Temperature Range is captured
    if (!specs['Temperature Range'] && p.description) {
        const tempMatch = p.description.match(/Temperature.*?:.*?([0-9\-°C\s]+)/i);
        if (tempMatch) {
            specs['Temperature Range'] = tempMatch[1].trim();
        }
    }

    // Ensure we have a capacity/volume value
    if (!specs['Gross Volume'] && !specs['Capacity'] && !specs['Volume']) {
        for (const [key, val] of Object.entries(specs)) {
            if (val.includes('L') && !isNaN(parseFloat(val))) {
                specs['Capacity'] = val;
                break;
            }
        }
    }

    return specs;
}

// ================================================================
//  CATEGORY-SPECIFIC ADD-ONS
// ================================================================
function getCategoryAddons(category, subCategory) {
    const baseAddons = {
        'Visi Cooler': ['LED Lighting', 'Digital Display', 'Castors (Wheels)', 'Lock', 'Auto-Defrost', 'Adjustable Shelves'],
        'Deep Freezer': ['Castors (Wheels)', 'LED Lighting', 'Digital Display', 'Lock', 'Convertible Technology', 'Glass Top'],
        'Ice Machine': ['Bubble Top', 'Storage Bin', 'Digital Display', 'Castors'],
        'Stainless Steel Refrigerators': ['GN Rail System', 'Drawers', 'Glass Door', 'Digital Display', 'Lock', 'Splash Back Top'],
        'Pastry Cabinet': ['LED Lighting', 'Digital Display', 'Castors', 'Lock', 'Adjustable Shelves'],
        'Supermarket Range': ['LED Lighting', 'Digital Display', 'Castors'],
        'Medical Refrigeration': ['Temperature Data Logger', 'Battery Backup', 'Lock', 'Audible Alarm'],
        'Storage Water Cooler': ['Digital Display', 'Castors'],
        'Back Bar': ['LED Lighting', 'Digital Display', 'Lock'],
        'Vertical Freezer': ['LED Lighting', 'Digital Display', 'Lock']
    };

    const subAddons = {
        'Counter Top': ['Adjustable Shelves'],
        'Single Door': ['Lock'],
        'Hard Top Deep Freezers': ['Convertible Technology', 'Baskets'],
        'Glass Top Deep Freezers': ['Glass Top', 'Baskets'],
        'Curved Glass Top': ['Curved Glass Display', 'Baskets'],
        'Hard Top Eutectic': ['Convertible Technology', 'Baskets'],
        'Hatched Top Eutectic': ['Convertible Technology', 'Baskets'],
        'Combination Freezers': ['Convertible Technology', 'Baskets'],
        'Freezer on Wheels': ['Castors (Wheels)'],
        'Glass Top Eutectic': ['Glass Top', 'Baskets'],
        'Scooping Parlour': ['Glass Top', 'Baskets'],
        'Upright Chiller': ['GN Rail System', 'Digital Display'],
        'Upright Freezer': ['GN Rail System', 'Digital Display'],
        'Under Counter Chiller': ['Splash Back Top', 'Drawers'],
        'Under Counter Freezer': ['Splash Back Top', 'Drawers'],
        'Under Counter Drawer': ['Drawers', 'Splash Back Top'],
        'Preparation Table': ['Cutting Board', 'Pan Stand'],
        'Pastry Cabinet': ['Adjustable Shelves'],
        'Golden Confectionery Cabinet': ['Adjustable Shelves'],
        'Chiller': ['LED Lighting', 'Digital Display'],
        'Freezer': ['LED Lighting', 'Digital Display'],
        'Vaccine Freezer': ['Temperature Data Logger', 'Battery Backup'],
        'Ice Lined Refrigerator': ['Temperature Data Logger', 'Battery Backup'],
        'Pharmaceutical Refrigerator': ['Temperature Data Logger', 'Battery Backup'],
        'Precoated Water Cooler': ['Digital Display'],
        'Stainless Steel Water Cooler': ['Digital Display']
    };

    let addons = [];
    if (baseAddons[category]) addons = [...baseAddons[category]];
    if (subAddons[subCategory]) {
        subAddons[subCategory].forEach(addon => {
            if (!addons.includes(addon)) addons.push(addon);
        });
    }
    return addons;
}

// ================================================================
//  SUB-CATEGORY SPECIFIC SELECTORS (COMPLETE LIST)
// ================================================================
function getSubCategorySelectors(mainCategory, subCategory) {
    const selectorMap = {
        // Visi Cooler
        'Visi Cooler__Counter Top': ['Gross Volume', 'Temperature Range'],
        'Visi Cooler__Single Door': ['Gross Volume', 'Temperature Range', 'No. of Shelves'],
        'Visi Cooler__Double Door': ['Gross Volume', 'Temperature Range', 'No. of Shelves'],
        'Visi Cooler__Triple Door': ['Gross Volume', 'Temperature Range', 'No. of Shelves'],

        // Deep Freezer
        'Deep Freezer__Hard Top Deep Freezers': ['Gross Volume', 'Energy Star Ratings', 'Temperature Range'],
        'Deep Freezer__Glass Top Deep Freezers': ['Gross Volume', 'Energy Star Ratings', 'Temperature Range'],
        'Deep Freezer__Curved Glass Top': ['Gross Volume', 'Energy Star Ratings', 'Temperature Range'],
        'Deep Freezer__Hard Top Eutectic': ['Gross Volume', 'Temperature Range'],
        'Deep Freezer__Hatched Top Eutectic': ['Gross Volume', 'Temperature Range'],
        'Deep Freezer__Combination Freezers': ['Gross Volume', 'Temperature Range'],
        'Deep Freezer__Freezer on Wheels': ['Gross Volume', 'Temperature Range'],
        'Deep Freezer__Glass Top Eutectic': ['Gross Volume', 'Temperature Range'],
        'Deep Freezer__Scooping Parlour': ['Gross Volume', 'Temperature Range'],

        // Ice Machine
        'Ice Machine__Western Ice Machine': ['Production Capacity', 'Ice Shape'],
        'Ice Machine__Hoshizaki Ice Machine': ['Production Capacity', 'Ice Shape'],
        'Ice Machine__Ice Flakers': ['Production Capacity', 'Ice Shape'],
        'Ice Machine__Storage Bins': ['Storage Capacity'],
        'Ice Machine__Ice Makers': ['Production Capacity', 'Ice Shape'],
        'Ice Machine__Ice Cuber Special Series': ['Production Capacity', 'Ice Shape'],
        'Ice Machine__Ice Dispenser': ['Production Capacity', 'Ice Shape'],

        // Stainless Steel Refrigerators
        'Stainless Steel Refrigerators__Upright Chiller': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Upright Freezer': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Upright Combination': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Under Counter Chiller': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Under Counter Freezer': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Under Counter Drawer': ['Gross Volume', 'Temperature Range'],
        'Stainless Steel Refrigerators__Preparation Table': ['Gross Volume', 'Temperature Range'],

        // Pastry Cabinet
        'Pastry Cabinet__Pastry Cabinet': ['Gross Volume', 'Temperature Range', 'No. of Shelves'],
        'Pastry Cabinet__Golden Confectionery Cabinet': ['Gross Volume', 'Temperature Range', 'No. of Shelves'],

        // Supermarket Range
        'Supermarket Range__Chiller': ['Gross Volume', 'Temperature Range'],
        'Supermarket Range__Freezer': ['Gross Volume', 'Temperature Range'],

        // Medical Refrigeration
        'Medical Refrigeration__Vaccine Freezer': ['Gross Volume', 'Temperature Range'],
        'Medical Refrigeration__Ice Lined Refrigerator': ['Gross Volume', 'Temperature Range'],
        'Medical Refrigeration__Pharmaceutical Refrigerator': ['Gross Volume', 'Temperature Range'],

        // Storage Water Cooler
        'Storage Water Cooler__Precoated Water Cooler': ['Storage Capacity', 'Cooling Rate'],
        'Storage Water Cooler__Stainless Steel Water Cooler': ['Storage Capacity', 'Cooling Rate'],

        // Back Bar
        'Back Bar__Back Bar': ['Gross Volume', 'Temperature Range'],

        // Vertical Freezer
        'Vertical Freezer__Vertical Freezer': ['Gross Volume', 'Temperature Range']
    };

    const key = `${mainCategory}__${subCategory}`;
    return selectorMap[key] || ['Gross Volume', 'Temperature Range'];
}

// ================================================================
//  BUILD DATA
// ================================================================

// Categories
const catMap = {};
products.forEach(p => {
    const main = getMainCategory(p);
    const sub = getSubCategory(p);
    if (!catMap[main]) {
        catMap[main] = { name: main, image: p.image || '', subCategories: [], productCount: 0 };
    }
    if (sub && !catMap[main].subCategories.includes(sub)) {
        catMap[main].subCategories.push(sub);
    }
    catMap[main].productCount++;
});
const categories = Object.values(catMap);

// Sub-categories
const subCatMap = {};
products.forEach(p => {
    const main = getMainCategory(p);
    const sub = getSubCategory(p);
    const key = `${main}__${sub}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    if (!subCatMap[key]) {
        subCatMap[key] = { name: sub, category: main, products: [] };
    }
    const keySpecs = extractKeySpecs(p);
    subCatMap[key].products.push({
        name: p.name,
        image: p.image || '',
        keySpecs
    });
});

// Product details with sub-category specific selectors
const productMap = {};
products.forEach(p => {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
    const family = getFamily(p.name);
    const variations = products.filter(x => getFamily(x.name) === family).map(x => x.name).filter(v => v !== p.name);
    const keySpecs = extractKeySpecs(p);
    const mainCat = getMainCategory(p);
    const subCat = getSubCategory(p);

    // Get the selectors specific to this sub-category
    const subCategorySelectors = getSubCategorySelectors(mainCat, subCat);

    // Get family products with their key specs
    const familyProducts = products
        .filter(x => getFamily(x.name) === family)
        .map(x => ({
            name: x.name,
            keySpecs: extractKeySpecs(x)
        }));

    productMap[safeName] = {
        name: p.name,
        category: p.category || 'Uncategorized',
        categoryPath: p.categoryPath || '',
        link: p.link || '',
        image: p.image || '',
        gallery: p.gallery || [],
        description: p.description || '',
        features: p.features || [],
        specifications: p.specifications || {},
        keySpecifications: keySpecs,
        differentiatingSpecs: subCategorySelectors,
        variations: {
            capacity: variations.length > 0 ? variations : [],
            addons: getCategoryAddons(mainCat, subCat),
            familyProducts: familyProducts
        }
    };
});

// WRITE FILES
const dataDir = path.join(__dirname, 'data');
const subDir = path.join(dataDir, 'subcategories');
const prodDir = path.join(dataDir, 'products');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(categories, null, 2));
console.log(`✅ categories.json (${categories.length} categories)`);

Object.keys(subCatMap).forEach(key => {
    fs.writeFileSync(path.join(subDir, `${key}.json`), JSON.stringify(subCatMap[key], null, 2));
});
console.log(`✅ ${Object.keys(subCatMap).length} subcategory files`);

Object.keys(productMap).forEach(key => {
    fs.writeFileSync(path.join(prodDir, `${key}.json`), JSON.stringify(productMap[key], null, 2));
});
console.log(`✅ ${Object.keys(productMap).length} product detail files`);

console.log('\n🎉 All data files generated successfully!');
console.log('\n📋 Sub-Category Specific Selectors:');
console.log('   Visi Cooler → Counter Top: Gross Volume, Temperature Range');
console.log('   Visi Cooler → Single Door: Gross Volume, Temperature Range, Shelves');
console.log('   Deep Freezer → Hard Top: Gross Volume, Star Rating, Temperature Range');
console.log('   Ice Machine → Western: Production Capacity, Ice Shape');
console.log('   Ice Machine → Ice Dispenser: Production Capacity, Ice Shape');
console.log('   Back Bar → Back Bar: Gross Volume, Temperature Range');
console.log('   Vertical Freezer → Vertical Freezer: Gross Volume, Temperature Range');