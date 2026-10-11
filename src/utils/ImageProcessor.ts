export function processPlayerMask(img: HTMLImageElement, cols: number, rows: number) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const frameW = canvas.width / cols;
    const frameH = canvas.height / rows;
    const frames = [];

    const addPoint = (arr: {x: number, y: number}[], x: number, y: number) => {
        for (const p of arr) {
            if (Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3) return; 
        }
        arr.push({x, y});
    };

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const engines: {x: number, y: number}[] = [];
            const wings: {x: number, y: number}[] = [];
            const mainGuns: {x: number, y: number}[] = [];
            const sideGuns: {x: number, y: number}[] = [];

            for (let py = 0; py < frameH; py++) {
                for (let px = 0; px < frameW; px++) {
                    const globalX = Math.floor(x * frameW + px);
                    const globalY = Math.floor(y * frameH + py);
                    const i = (globalY * canvas.width + globalX) * 4;
                    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];

                    if (a > 100) {
                        const locX = px - frameW / 2;
                        const locY = py - frameH / 2;

                        if (b > 200 && r < 100 && g < 100) addPoint(mainGuns, locX, locY); 
                        else if (r > 200 && g > 200 && b < 100) addPoint(sideGuns, locX, locY); 
                        else if (r > 200 && g < 100 && b < 100) addPoint(engines, locX, locY); 
                        else if (g > 200 && r < 100 && b < 100) addPoint(wings, locX, locY); 
                    }
                }
            }
            frames.push({ engines, wings, mainGuns, sideGuns });
        }
    }
    return frames;
}