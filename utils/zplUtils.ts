import { Product } from '../types';

interface LabelConfig {
    widthMm: number;
    heightMm: number;
    cols: 1 | 2;
    identifier: 'sku' | 'imei1' | 'serialNumber';
}

export const generateZPL = (products: Product[], config: LabelConfig): string => {
    let zpl = '^XA'; // Start Format
    zpl += '^PW' + (config.widthMm * 8 * config.cols); // Print Width (approx 8 dots per mm for 203dpi)
    zpl += '^LL' + (config.heightMm * 8); // Label Length
    zpl += '^PON'; // Print Orientation Normal
    zpl += '^LH0,0'; // Label Home

    // Common ZPL settings
    const printDarkness = 15; // 0-30
    zpl += `^MD${printDarkness}`;

    products.forEach((product, index) => {
        // For 2 columns, we might need to handle positions differently if they are on the same "row" physically
        // But usually ZPL printers handle "labels across" via sensor configuration or multiple logical labels
        // Here we will generate one logical label command set per product. 
        // If the printer is set up for 2-across with a single gap sensor, we typically send data for both labels in one ^XA...^XZ block 
        // OR we treat it as one wide label.

        // Simpler approach for compatibility: Generate individual labels. 
        // User driver settings usually handle "2 up" imposition if configured, 
        // OR we perform "2 up" logic manually here if we treat the page as 100mm wide.

        // Let's implement the "2 up" logic manually if cols=2, effectively treating 2 labels as 1 printable area

        if (config.cols === 2) {
            if (index % 2 === 0) {
                // Start of a pair
                zpl += '^XA';
                zpl += generateLabelContent(product, 0, config);

                // If there is a next product, print it on the right side
                if (index + 1 < products.length) {
                    zpl += generateLabelContent(products[index + 1], config.widthMm * 8, config);
                }
                zpl += '^XZ';
            }
        } else {
            // Single column
            zpl += '^XA';
            zpl += generateLabelContent(product, 0, config);
            zpl += '^XZ';
        }
    });

    return zpl;
};

const generateLabelContent = (product: Product, xOffsetDots: number, config: LabelConfig): string => {
    let content = '';
    const dotsPerMm = 8; // 203 DPI approx

    // Helper to calc X
    const getX = (mm: number) => Math.floor((mm * dotsPerMm) + xOffsetDots);
    const getY = (mm: number) => Math.floor(mm * dotsPerMm);

    // 1. Store Name (Header) - Centered top
    // ^FOx,y^A0N,h,w^FDtext^FS
    content += `^FO${getX(config.widthMm / 2 - 20)},${getY(2)}^A0N,25,25^FDISTORE PRO^FS`;

    // 2. Product Description - bounded box
    // ^FOx,y^FBwidth,lines,0,C,0^A0N,h,w^FDtext^FS
    const desc = `${product.model} ${product.color || ''} ${product.storage || ''} ${product.condition || ''}`;
    content += `^FO${getX(2)},${getY(6)}^FB${Math.floor((config.widthMm - 4) * dotsPerMm)},2,0,C,0^A0N,20,20^FD${escapeZpl(desc)}^FS`;

    // 3. Identifier value (Barcode)
    // Code 128: ^BCN,h,f,f,f,m
    let identifierValue = '';
    if (config.identifier === 'sku') identifierValue = product.sku || '';
    if (config.identifier === 'imei1') identifierValue = product.imei1 || '';
    if (config.identifier === 'serialNumber') identifierValue = product.serialNumber || '';

    if (!identifierValue) identifierValue = 'INVALID';

    content += `^FO${getX(4)},${getY(12)}^BY2,2,50^BCN,50,Y,N,N^FD${identifierValue}^FS`;

    // 4. Price
    const priceFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price);
    content += `^FO${getX(config.widthMm / 2 - 15)},${getY(21)}^A0N,30,30^FD${priceFormatted}^FS`;

    return content;
};

const escapeZpl = (str: string) => {
    return str.replace(/_/g, ' ').replace(/\^/g, ' ').replace(/~/g, ' ');
};
