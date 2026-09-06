// ================================================================
//  build-data.js – Complete rewrite with all fixes
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

        // Check if line contains a colon
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            // If we had a previous key, save it
            if (currentKey) {
                specs[currentKey] = currentValue.join(' ').trim();
                currentKey = null;
                currentValue = [];
            }

            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            // If value is not empty, store directly; else hold key for multi-line
            if (value) {
                const normKey = normalizeKey(key);
                specs[normKey] = value;
            } else {
                currentKey = normalizeKey(key);
                currentValue = [];
            }
        } else {
            // Continuation line
            if (currentKey) {
                currentValue.push(line);
            }
        }
    }

    // Save last key
    if (currentKey && currentValue.length > 0) {
        specs[currentKey] = currentValue.join(' ').trim();
    }

    return specs;
}

// Extract only important specs (for keySpecifications)
function extractKeySpecs(description) {
    const all = extractSpecs(description);
    // Keep only commonly used ones
    const important = ['Gross Volume', 'Temperature Range', 'Shelves', 'Star Rating',
        'Production Capacity', 'Ice Shape', 'Storage Capacity', 'Cooling Rate',
        'Dimensions', 'Capacity'];
    const result = {};
    for (const key of important) {
        if (all[key]) result[key] = all[key];
    }
    // If we have a generic 'Capacity' but no 'Gross Volume', use it
    if (!result['Gross Volume'] && all['Capacity']) {
        result['Gross Volume'] = all['Capacity'];
    }
    // Ensure we have at least one spec
    if (Object.keys(result).length === 0 && Object.keys(all).length > 0) {
        // Take first two specs as fallback
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
        // If only one product, return a default set
        return ['Gross Volume', 'Temperature Range'];
    }

    // Collect all possible spec keys across products
    const allKeys = new Set();
    productList.forEach(p => {
        const specs = p.keySpecs || {};
        Object.keys(specs).forEach(k => allKeys.add(k));
    });

    // Find specs that have at least two distinct non-empty values
    const differentiating = [];
    allKeys.forEach(key => {
        const values = productList
            .map(p => (p.keySpecs || {})[key])
            .filter(v => v && v.trim() !== '');
        if (values.length > 1) {
            // Check uniqueness
            const unique = new Set(values);
            if (unique.size > 1) {
                differentiating.push(key);
            }
        }
    });

    // If no differentiating specs found, fallback to 'Gross Volume' and 'Temperature Range'
    if (differentiating.length === 0) {
        // Use any available spec
        const available = Array.from(allKeys).filter(k => {
            return productList.some(p => (p.keySpecs || {})[k]);
        });
        if (available.length > 0) {
            return available.slice(0, 3);
        }
        return ['Gross Volume', 'Temperature Range'];
    }

    // Limit to top 3 for UI neatness
    return differentiating.slice(0, 3);
}

// Clean gallery: remove invalid SVG placeholders
function cleanGallery(gallery) {
    if (!gallery || !Array.isArray(gallery)) return [];
    return gallery.filter(url => {
        // Remove data:image/svg+xml placeholders
        if (url.startsWith('data:image/svg+xml')) return false;
        // Remove obvious placeholders
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
            // Capitalize first letter
            const capitalized = keyword.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            found.add(capitalized);
        }
    });
    // Add some common ones if not found
    if (found.size === 0) {
        // Fallback to some generic ones based on category? We'll keep empty.
    }
    return Array.from(found);
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
        catMap[main] = { name: main, image: p.image || '', subCategories: [], productCount: 0 };
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
        image: p.image || '',
        keySpecs
    });
});

// 3.3 Product details
const productMap = {};
products.forEach(p => {
    const safeName = p.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();

    // Extract all specs for full specifications
    const allSpecs = extractSpecs(p.description);

    // Key specs (only important ones)
    const keySpecs = extractKeySpecs(p.description);

    // Clean gallery
    const gallery = cleanGallery(p.gallery || []);

    // Determine family – group by subcategory (so only same subcat products appear)
    const mainCat = getMainCategory(p);
    const subCat = getSubCategory(p);
    const familyProducts = products
        .filter(x => getSubCategory(x) === subCat && x.name !== p.name)
        .map(x => ({
            name: x.name,
            keySpecs: extractKeySpecs(x.description)
        }));

    // Add-ons
    const addons = getAddonsFromDescription(p.description, p.features);

    // Differentiating specs for this subcategory (will be computed later per subcat)
    // We'll store the keySpecs and let the per-subcat logic compute differentiating.

    productMap[safeName] = {
        name: p.name,
        category: p.category || 'Uncategorized',
        categoryPath: getFullCategoryPath(p),
        link: p.link || '',
        image: p.image || '',
        gallery: gallery.length > 0 ? gallery : [p.image],
        description: p.description || '',
        features: p.features || [],
        specifications: allSpecs,
        keySpecifications: keySpecs,
        // Differentiating specs will be added per subcategory later
        differentiatingSpecs: [], // placeholder
        variations: {
            capacity: familyProducts.map(fp => fp.name),
            addons: addons,
            familyProducts: familyProducts
        }
    };
});

// 3.4 Now, for each subcategory, compute its differentiating specs and update product files
Object.keys(subCatMap).forEach(subKey => {
    const subData = subCatMap[subKey];
    const productList = subData.products;
    const diffSpecs = getDifferentiatingSpecs(productList);

    // For each product in this subcategory, update its detail file with diffSpecs
    productList.forEach(prod => {
        const safeName = prod.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
        if (productMap[safeName]) {
            productMap[safeName].differentiatingSpecs = diffSpecs;
        }
    });
});

// 3.5 Enhance category images – use the most common image from products
Object.keys(catMap).forEach(catName => {
    const cat = catMap[catName];
    // Find all products in this category
    const catProducts = products.filter(p => getMainCategory(p) === catName);
    if (catProducts.length > 0) {
        // Use the first product's image as category image, but you could pick the most frequent
        cat.image = catProducts[0].image || '';
    }
});

// ----------------------------------------------------------------
// 4. Write files
// ----------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
const subDir = path.join(dataDir, 'subcategories');
const prodDir = path.join(dataDir, 'products');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true });

// 4.1 Categories
const categories = Object.values(catMap);
fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(categories, null, 2));
console.log(`✅ categories.json (${categories.length} categories)`);

// 4.2 Subcategories
Object.keys(subCatMap).forEach(key => {
    fs.writeFileSync(path.join(subDir, `${key}.json`), JSON.stringify(subCatMap[key], null, 2));
});
console.log(`✅ ${Object.keys(subCatMap).length} subcategory files`);

// 4.3 Product details
Object.keys(productMap).forEach(key => {
    fs.writeFileSync(path.join(prodDir, `${key}.json`), JSON.stringify(productMap[key], null, 2));
});
console.log(`✅ ${Object.keys(productMap).length} product detail files`);

// 4.4 Optional: Log a summary of categories
console.log('\n📊 Summary:');
console.log(`  Categories: ${categories.length}`);
console.log(`  Subcategories: ${Object.keys(subCatMap).length}`);
console.log(`  Products: ${Object.keys(productMap).length}`);

console.log('\n🎉 All data files generated successfully!');