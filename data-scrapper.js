// ================================================================
//  SCRAPER V2: Extracts ALL Products with FULL Details (No Price)
//  Run this on: https://westernequipments.com/products/
// ================================================================

(async function() {
    // ---- Helper: Get specifications from product page ----
    function extractSpecifications(doc) {
        const specs = {};
        const specRows = doc.querySelectorAll('.product-specs tr, .woocommerce-product-attributes tr, .specifications tr, table tr');
        specRows.forEach(row => {
            const label = row.querySelector('th, .label');
            const value = row.querySelector('td, .value');
            if (label && value) {
                const key = label.textContent.trim().replace(/:/g, '').trim();
                const val = value.textContent.trim();
                if (key && val) {
                    specs[key] = val;
                }
            }
        });
        const specItems = doc.querySelectorAll('.spec-item, .product-attribute, .attribute');
        specItems.forEach(item => {
            const label = item.querySelector('.label, .attribute-label, strong');
            const value = item.querySelector('.value, .attribute-value');
            if (label && value) {
                const key = label.textContent.trim().replace(/:/g, '').trim();
                const val = value.textContent.trim();
                if (key && val) {
                    specs[key] = val;
                }
            }
        });
        return specs;
    }

    // ---- Helper: Get description ----
    function extractDescription(doc) {
        const desc = doc.querySelector('.product-description, .woocommerce-product-details__short-description, .product-short-description');
        if (desc) return desc.textContent.trim();
        const longDesc = doc.querySelector('.woocommerce-Tabs-panel--description, .product-long-description');
        if (longDesc) return longDesc.textContent.trim();
        return '';
    }

    // ---- Helper: Get features list ----
    function extractFeatures(doc) {
        const features = [];
        const featureItems = doc.querySelectorAll('.feature-item, .product-features li, .benefits li');
        featureItems.forEach(item => {
            const text = item.textContent.trim();
            if (text) features.push(text);
        });
        return features;
    }

    // ---- Helper: Get category from breadcrumb ----
    function extractCategoryFromBreadcrumb(doc) {
        const breadcrumb = doc.querySelector('.breadcrumb, .woocommerce-breadcrumb');
        if (breadcrumb) {
            const links = breadcrumb.querySelectorAll('a');
            if (links.length >= 2) {
                return links[links.length - 1].textContent.trim();
            }
        }
        return '';
    }

    // ---- Helper: Get product name ----
    function extractProductName(doc) {
        const name = doc.querySelector('h1.product-title, h1.entry-title, .product_name');
        if (name) return name.textContent.trim();
        return '';
    }

    // ---- Helper: Get full category path from breadcrumb ----
    function extractFullCategoryPath(doc) {
        const breadcrumb = doc.querySelector('.breadcrumb, .woocommerce-breadcrumb');
        if (breadcrumb) {
            const links = breadcrumb.querySelectorAll('a');
            const path = [];
            links.forEach(link => {
                const text = link.textContent.trim();
                if (text && text !== 'Home' && text !== 'Products') {
                    path.push(text);
                }
            });
            return path.join(' → ');
        }
        return '';
    }

    // ---- MAIN: Get all product links from the listing page ----
    function getProductLinksFromPage() {
        const links = [];
        document.querySelectorAll('.product-item a, .product a, li.product a, .product-title a, .product-name a, .woocommerce-loop-product__link').forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes('/product/')) {
                if (!links.includes(href) && !href.includes('/products/')) {
                    links.push(href);
                }
            }
        });
        return links;
    }

    // ---- MAIN: Fetch product details from each page ----
    const allProducts = [];
    const productLinks = getProductLinksFromPage();

    console.log(`🔍 Found ${productLinks.length} product links.`);

    for (let i = 0; i < productLinks.length; i++) {
        const link = productLinks[i];
        console.log(`📄 Fetching ${i + 1}/${productLinks.length}: ${link}`);

        try {
            const resp = await fetch(link);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const name = extractProductName(doc);
            const category = extractCategoryFromBreadcrumb(doc);
            const categoryPath = extractFullCategoryPath(doc);
            const description = extractDescription(doc);
            const features = extractFeatures(doc);
            const specs = extractSpecifications(doc);

            // Extract main image
            let image = '';
            const imgEl = doc.querySelector('.product-image img, .woocommerce-product-gallery img, img.wp-post-image, .product img');
            if (imgEl) {
                image = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
                if (image && !image.startsWith('http')) image = 'https:' + image;
                const highRes = image.replace('-300x300', '-800x1000');
                if (highRes !== image) image = highRes;
            }

            // Get all gallery images
            const galleryImages = [];
            doc.querySelectorAll('.woocommerce-product-gallery img, .product-gallery img, .product-images img').forEach(img => {
                let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (src && !src.includes('logo') && !src.includes('icon')) {
                    if (!src.startsWith('http')) src = 'https:' + src;
                    const highRes = src.replace('-300x300', '-800x1000');
                    if (highRes !== src) src = highRes;
                    if (!galleryImages.includes(src) && !src.includes('thumb')) {
                        galleryImages.push(src);
                    }
                }
            });

            // Extract key specifications (important ones only)
            const keySpecs = {};
            const importantKeys = ['Capacity', 'Volume', 'Dimensions', 'Width', 'Height', 'Depth', 'Temperature', 'Power', 'Voltage', 'Compressor', 'Refrigerant', 'Material', 'Door Type', 'Type'];
            Object.keys(specs).forEach(key => {
                const matchedKey = importantKeys.find(ik => key.toLowerCase().includes(ik.toLowerCase()));
                if (matchedKey) {
                    keySpecs[matchedKey] = specs[key];
                }
            });

            allProducts.push({
                name: name || 'Unknown',
                model: name || 'Unknown',
                category: category || 'Uncategorized',
                categoryPath: categoryPath || '',
                link: link,
                image: image,
                gallery: galleryImages.slice(0, 5),
                description: description || '',
                features: features || [],
                specifications: specs || {},
                keySpecifications: keySpecs || {},
                source: 'Western Equipment',
                scrapedAt: new Date().toISOString()
            });

            console.log(`   ✅ ${name} (${category})`);

        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 400));
    }

    console.log(`\n✅ Completed! Scraped ${allProducts.length} products.`);
    console.log(JSON.stringify(allProducts, null, 2));
    await navigator.clipboard.writeText(JSON.stringify(allProducts, null, 2));
    console.log('📋 Data copied to clipboard. Paste it here.');
})();