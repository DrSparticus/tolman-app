// filepath: c:\Users\BSSpa\tolman-app\src\utils\materialStructure.js
export const getMaterialStructureByType = (type) => {
    switch (type) {
        case 'Container':
            return {
                sizing: {
                    containerSize: '', // How many units per container
                    unit: '' // What unit (sheets, rolls, etc.)
                },
                sizes: [] // No sizes for containers
            };
        
        case 'Each':
            return {
                sizing: {
                    unit: 'each'
                },
                sizes: [] // No sizes for each
            };
        
        case 'Linear Feet':
            return {
                sizing: {
                    unit: 'linear feet'
                },
                sizes: [
                    { name: '', length: '' } // Just name and length
                ]
            };
        
        default:
            return {
                sizing: {
                    unit: type.toLowerCase()
                },
                sizes: []
            };
    }
};