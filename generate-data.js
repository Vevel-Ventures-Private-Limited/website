// ================================================================
//  build-data.js – Complete rewrite with all fixes + proxy URLs
//  Run: node build-data.js
// ================================================================

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------
// 1. Load raw product data
// ----------------------------------------------------------------
let products;
try {
    const raw = fs.readFileSync('products.json', 'utf8');
    products = JSON.parse(raw);
    console.log(`✅ Loaded ${products.length} products`);
} catch (e) {
    console.error('❌ products.json not found!');
    process.exit(1);
}

// ----------------------------------------------------------------
// 2. Helpers
// ----------------------------------------------------------------
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

function getFullCategoryPath(p) {
    return p.categoryPath || p.category || '';
}

// Normalize spec keys to a canonical form
function normalizeKey(key) {
    const map = {
        'Gross volume': 'Gross Volume',
        'Gross Volume': 'Gross Volume',
        'Temperature range': 'Temperature Range',
        'Temperature range (°C)': 'Temperature Range',
        'Temperature Range': 'Temperature Range',
        'No. of Shelves': 'Shelves',
        'Shelves': 'Shelves',
        'Energy Star Ratings': 'Star Rating',
        'Star Rating': 'Star Rating',
        'Production Capacity': 'Production Capacity',
        'Capacity': 'Capacity',
        'Ice Shape': 'Ice Shape',
        'Storage Capacity': 'Storage Capacity',
        'Cooling Rate': 'Cooling Rate',
        'Dimensions': 'Dimensions',
        'Dimension': 'Dimensions'
    };
    return map[key] || key;
}

// Extract key-value specs from description with line continuation
function extractSpecs(description) {
    const specs = {};
    if (!description) return specs;

    const lines = description.split('\n');
    let currentKey = null;
    let currentValue = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            if (currentKey) {
                specs[currentKey] = currentValue.join(' ').trim();
                currentKey = null;
                currentValue = [];
            }

            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            if (value) {
                const normKey = normalizeKey(key);
                specs[normKey] = value;
            } else {
                currentKey = normalizeKey(key);
                currentValue = [];
            }
        } else {
            if (currentKey) {
                currentValue.push(line);
            }
        }
    }

    if (currentKey && currentValue.length > 0) {
        specs[currentKey] = currentValue.join(' ').trim();
    }

    return specs;
}

// Extract only important specs (for keySpecifications)
function extractKeySpecs(description) {
    const all = extractSpecs(description);
    const important = ['Gross Volume', 'Temperature Range', 'Shelves', 'Star Rating',
        'Production Capacity', 'Ice Shape', 'Storage Capacity', 'Cooling Rate',
        'Dimensions', 'Capacity'];
    const result = {};
    for (const key of important) {
        if (all[key]) result[key] = all[key];
    }
    if (!result['Gross Volume'] && all['Capacity']) {
        result['Gross Volume'] = all['Capacity'];
    }
    if (Object.keys(result).length === 0 && Object.keys(all).length > 0) {
        const entries = Object.entries(all);
        for (let i = 0; i < Math.min(2, entries.length); i++) {
            result[entries[i][0]] = entries[i][1];
        }
    }
    return result;
}

// Determine differentiating specs dynamically from a list of products
function getDifferentiatingSpecs(productList) {
    if (!productList || productList.length < 2) {
        return ['Gross Volume', 'Temperature Range'];
    }

    const allKeys = new Set();
    productList.forEach(p => {
        const specs = p.keySpecs || {};
        Object.keys(specs).forEach(k => allKeys.add(k));
    });

    const differentiating = [];
    allKeys.forEach(key => {
        const values = productList
            .map(p => (p.keySpecs || {})[key])
            .filter(v => v && v.trim() !== '');
        if (values.length > 1) {
            const unique = new Set(values);
            if (unique.size > 1) {
                differentiating.push(key);
            }
        }
    });

    if (differentiating.length === 0) {
        const available = Array.from(allKeys).filter(k => {
            return productList.some(p => (p.keySpecs || {})[k]);
        });
        if (available.length > 0) {
            return available.slice(0, 3);
        }
        return ['Gross Volume', 'Temperature Range'];
    }

    return differentiating.slice(0, 3);
}

// Clean gallery: remove invalid SVG placeholders
function cleanGallery(gallery) {
    if (!gallery || !Array.isArray(gallery)) return [];
    return gallery.filter(url => {
        if (url.startsWith('data:image/svg+xml')) return false;
        if (url.includes('placeholder')) return false;
        return true;
    });
}

// Determine add-ons by scanning description and features
function getAddonsFromDescription(description, features = []) {
    const addonKeywords = [
        'castors', 'wheels', 'LED lighting', 'digital display', 'lock',
        'convertible technology', 'glass top', 'baskets', 'adjustable shelves',
        'splash back', 'drawers', 'GN rail', 'cutting board', 'pan stand',
        'temperature data logger', 'battery backup', 'audible alarm',
        'auto-defrost', 'bubble top'
    ];
    const found = new Set();
    const text = (description + ' ' + (features || []).join(' ')).toLowerCase();
    addonKeywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
            const capitalized = keyword.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            found.add(capitalized);
        }
    });
    return Array.from(found);
}

// ----------------------------------------------------------------
// NEW: Proxy image URLs to use Cloudflare Worker
// ----------------------------------------------------------------
function proxyImageUrl(url) {
    if (!url) return url;
    if (url.startsWith('https://westernequipments.com/wp-content/uploads/')) {
        return url.replace('https://westernequipments.com/wp-content/uploads/', 'https://vevelventures.com/wp-content/images/');
    }
    return url;
}

// ----------------------------------------------------------------
// 3. Build data structures
// ----------------------------------------------------------------

// 3.1 Categories
const catMap = {};
products.forEach(p => {
    const main = getMainCategory(p);
    const sub = getSubCategory(p);
    if (!catMap[main]) {
        catMap[main] = { 
            name: main, 
            image: proxyImageUrl(p.image || ''),   // ← Apply proxy
            subCategories: [], 
            productCount: 0 
        };
    }
    if (sub && !catMap[main].subCategories.includes(sub)) {
        catMap[main].subCategories.push(sub);
    }
    catMap[main].productCount++;
});

// 3.2 Subcategories and their products
const subCatMap = {};
products.forEach(p => {
    const main = getMainCategory(p);
    const sub = getSubCategory(p);
    const key = `${main}__${sub}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    if (!subCatMap[key]) {
        subCatMap[key] = { name: sub, category: main, products: [] };
    }
    const keySpecs = extractKeySpecs(p.description);
    subCatMap[key].products.push({
        name: p.name,
        image: proxyImageUrl(p.image || ''),   // ← Apply proxy
        keySpecs
    });
});

// 3.3 Product details
const productMap = {};
products.forEach(p => {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();

    const allSpecs = extractSpecs(p.description);
    const keySpecs = extractKeySpecs(p.description);
    const gallery = cleanGallery(p.gallery || []).map(proxyImageUrl);   // ← Apply proxy to gallery

    const mainCat = getMainCategory(p);
    const subCat = getSubCategory(p);
    const familyProducts = products
        .filter(x => getSubCategory(x) === subCat && x.name !== p.name)
        .map(x => ({
            name: x.name,
            keySpecs: extractKeySpecs(x.description)
        }));

    const addons = getAddonsFromDescription(p.description, p.features);

    productMap[safeName] = {
        name: p.name,
        category: p.category || 'Uncategorized',
        categoryPath: getFullCategoryPath(p),
        link: p.link || '',
        image: proxyImageUrl(p.image || ''),   // ← Apply proxy
        gallery: gallery.length > 0 ? gallery : [proxyImageUrl(p.image || '')],
        description: p.description || '',
        features: p.features || [],
        specifications: allSpecs,
        keySpecifications: keySpecs,
        differentiatingSpecs: [],
        variations: {
            capacity: familyProducts.map(fp => fp.name),
            addons: addons,
            familyProducts: familyProducts
        }
    };
});

// 3.4 Compute differentiating specs per subcategory and update product files
Object.keys(subCatMap).forEach(subKey => {
    const subData = subCatMap[subKey];
    const productList = subData.products;
    const diffSpecs = getDifferentiatingSpecs(productList);

    productList.forEach(prod => {
        const safeName = prod.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
        if (productMap[safeName]) {
            productMap[safeName].differentiatingSpecs = diffSpecs;
        }
    });
});

// 3.5 Enhance category images – already proxied, but we keep as is
// (no extra work needed)

// ----------------------------------------------------------------
// 4. Write files
// ----------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
const subDir = path.join(dataDir, 'subcategories');
const prodDir = path.join(dataDir, 'products');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true });

const categories = Object.values(catMap);
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

console.log('\n📊 Summary:');
console.log(`  Categories: ${categories.length}`);
console.log(`  Subcategories: ${Object.keys(subCatMap).length}`);
console.log(`  Products: ${Object.keys(productMap).length}`);

console.log('\n🎉 All data files generated successfully!');