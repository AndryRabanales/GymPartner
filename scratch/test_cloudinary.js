
const getOptimizedImageUrl = (url, options = {}) => {
    if (!url) return url;
    
    // If it's not a Cloudinary URL, return as is
    if (!url.includes('res.cloudinary.com')) return url;

    const { width = 600, height = 600, crop = 'fill' } = options;
    
    // Handle both full URLs and public IDs
    if (url.includes('/upload/')) {
        const parts = url.split('/upload/');
        const transform = `c_${crop},w_${width},h_${height},f_auto,q_auto:good`;
        return `${parts[0]}/upload/${transform}/${parts[1]}`;
    }

    return url;
};

const testUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
console.log("Input:", testUrl);
console.log("Output:", getOptimizedImageUrl(testUrl, { width: 400, height: 400 }));

const testUrl2 = "https://ui-avatars.com/api/?name=John";
console.log("Input:", testUrl2);
console.log("Output:", getOptimizedImageUrl(testUrl2, { width: 400, height: 400 }));
