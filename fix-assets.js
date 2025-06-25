const fs = require('fs');
const path = require('path');

// Function to recursively find and fix absolute paths in files
function fixAbsolutePaths(directory) {
    const files = fs.readdirSync(directory, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(directory, file.name);

        if (file.isDirectory()) {
            fixAbsolutePaths(fullPath);
        } else if (file.isFile()) {
            // Check if it's an HTML file or JavaScript file
            if (file.name.endsWith('.html') || file.name.endsWith('.js')) {
                try {
                    let content = fs.readFileSync(fullPath, 'utf8');
                    let modified = false;

                    // Fix absolute paths in HTML files
                    if (file.name.endsWith('.html')) {
                        const originalContent = content;
                        content = content.replace(/href="\/_next\//g, 'href="./_next/');
                        content = content.replace(/src="\/_next\//g, 'src="./_next/');
                        modified = originalContent !== content;
                    }

                    // Fix absolute paths in JavaScript files
                    if (file.name.endsWith('.js')) {
                        const originalContent = content;
                        content = content.replace(/"\/_next\//g, '"./_next/');
                        content = content.replace(/'\/_next\//g, "'./_next/");
                        modified = originalContent !== content;
                    }

                    if (modified) {
                        fs.writeFileSync(fullPath, content, 'utf8');
                        console.log(`Fixed absolute paths in: ${fullPath}`);
                    }
                } catch (error) {
                    console.error(`Error processing ${fullPath}:`, error.message);
                }
            }
        }
    }
}

// Start fixing from the out directory
const outDir = path.join(__dirname, 'out');
if (fs.existsSync(outDir)) {
    console.log('Fixing absolute paths in built files...');
    fixAbsolutePaths(outDir);
    console.log('Asset path fix completed!');
} else {
    console.error('out directory not found. Please build the project first.');
} 