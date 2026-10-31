/** Lee un archivo de imagen y lo devuelve como JPEG redimensionado (máx. 800 px) en dataURL */
export function comprimirImagen(file: File, max = 800, calidad = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen no válida'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', calidad));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Imagen ilustrativa para los datos de ejemplo */
export function imagenEjemplo(categoria: string, texto: string, color: string): string {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 300;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f3ef';
  g.fillRect(0, 0, 400, 300);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 8;
  const cat = categoria.toLowerCase();
  if (cat.includes('silla') || cat.includes('taburete')) {
    g.fillRect(140, 150, 120, 18);
    g.fillRect(150, 60, 14, 95);
    g.fillRect(236, 60, 14, 95);
    g.fillRect(150, 60, 100, 40);
    g.fillRect(145, 165, 10, 80);
    g.fillRect(245, 165, 10, 80);
  } else if (cat.includes('butaca') || cat.includes('sofá') || cat.includes('sofa')) {
    const w = cat.includes('sof') ? 260 : 170;
    const x = 200 - w / 2;
    g.fillRect(x, 80, w, 70);
    g.fillRect(x - 20, 120, 30, 90);
    g.fillRect(x + w - 10, 120, 30, 90);
    g.fillRect(x, 150, w, 50);
    g.fillRect(x, 200, 10, 30);
    g.fillRect(x + w - 10, 200, 10, 30);
  } else if (cat.includes('mesa')) {
    g.fillRect(90, 110, 220, 16);
    g.fillRect(110, 126, 12, 110);
    g.fillRect(278, 126, 12, 110);
  } else if (cat.includes('cama') || cat.includes('cabecero')) {
    g.fillRect(80, 60, 240, 90);
    g.fillRect(70, 150, 260, 60);
    g.fillRect(80, 210, 12, 25);
    g.fillRect(308, 210, 12, 25);
  } else if (cat.includes('ilumin') || cat.includes('lámpara') || cat.includes('lampara')) {
    g.beginPath();
    g.moveTo(150, 120);
    g.lineTo(250, 120);
    g.lineTo(225, 60);
    g.lineTo(175, 60);
    g.closePath();
    g.fill();
    g.fillRect(196, 120, 8, 100);
    g.fillRect(160, 220, 80, 12);
  } else {
    g.fillRect(100, 70, 200, 160);
    g.fillStyle = '#f4f3ef';
    g.fillRect(110, 145, 180, 4);
  }
  g.fillStyle = '#333';
  g.font = '600 18px sans-serif';
  g.textAlign = 'center';
  g.fillText(texto, 200, 275);
  return c.toDataURL('image/jpeg', 0.85);
}
