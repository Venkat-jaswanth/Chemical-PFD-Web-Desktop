import Konva from 'konva';
import jsPDF from 'jspdf';
import { ExportOptions, CanvasItem, Connection } from '@/components/Canvas/types';
import { calculateManualPathsWithBridges } from '@/utils/routing';

/* -------------------------------------------
   DEBUGGED CONTENT BOUNDS - FIXED
-------------------------------------------- */
function getContentBounds(items: CanvasItem[], connections: Connection[]) {
  if (!items.length && !connections.length) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Include items - these are already in canvas coordinates
  items.forEach(item => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  // Include connection paths (including waypoints)
  const connectionPaths = calculateManualPathsWithBridges(connections, items);
  
  Object.values(connectionPaths).forEach(path => {
    if (path?.pathData) {
      // For connections, we need to extract points from the SVG path
      const points = extractPointsFromSVGPath(path.pathData);
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    }
  });

  // If no items found (shouldn't happen), use connection bounds
  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 500;
    maxY = 500;
  }

  // Add a small margin to ensure everything fits
  const margin = 20;
  return {
    x: minX - margin,
    y: minY - margin,
    width: (maxX - minX) + margin * 2,
    height: (maxY - minY) + margin * 2,
  };
}

/* -------------------------------------------
   SIMPLIFIED SVG PATH PARSING
-------------------------------------------- */
function extractPointsFromSVGPath(pathData: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  
  // Split by commands (M, L, C, etc.)
  const commands = pathData.split(/(?=[A-Za-z])/);
  
  let lastX = 0;
  let lastY = 0;
  
  commands.forEach(cmd => {
    if (!cmd) return;
    
    const type = cmd[0];
    const numbers = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    
    switch (type) {
      case 'M': // Move to (absolute)
        if (numbers.length >= 2) {
          lastX = numbers[0];
          lastY = numbers[1];
          points.push({ x: lastX, y: lastY });
        }
        break;
        
      case 'm': // Move to (relative)
        if (numbers.length >= 2) {
          lastX += numbers[0];
          lastY += numbers[1];
          points.push({ x: lastX, y: lastY });
        }
        break;
        
      case 'L': // Line to (absolute)
        for (let i = 0; i < numbers.length; i += 2) {
          if (numbers[i] !== undefined && numbers[i + 1] !== undefined) {
            lastX = numbers[i];
            lastY = numbers[i + 1];
            points.push({ x: lastX, y: lastY });
          }
        }
        break;
        
      case 'l': // Line to (relative)
        for (let i = 0; i < numbers.length; i += 2) {
          if (numbers[i] !== undefined && numbers[i + 1] !== undefined) {
            lastX += numbers[i];
            lastY += numbers[i + 1];
            points.push({ x: lastX, y: lastY });
          }
        }
        break;
        
      case 'C': // Cubic bezier (absolute)
        if (numbers.length >= 6) {
          // Only track the end point
          lastX = numbers[4];
          lastY = numbers[5];
          points.push({ x: lastX, y: lastY });
        }
        break;
        
      case 'c': // Cubic bezier (relative)
        if (numbers.length >= 6) {
          lastX += numbers[4];
          lastY += numbers[5];
          points.push({ x: lastX, y: lastY });
        }
        break;
        
      case 'Z':
      case 'z':
        // Close path - no new point
        break;
    }
  });
  
  return points;
}

/* -------------------------------------------
   CREATE EXPORT STAGE - SIMPLIFIED
-------------------------------------------- */
function createExportStage(
  originalStage: Konva.Stage,
  items: CanvasItem[],
  connections: Connection[],
  includeGrid: boolean = false
): { stage: Konva.Stage; container: HTMLDivElement } {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '10000px';
  container.style.height = '10000px';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  // Get the original stage's layers
  const layers = originalStage.children || [];
  
  // Create new stage with original dimensions
  const exportStage = new Konva.Stage({
    container,
    width: originalStage.width(),
    height: originalStage.height(),
    scale: { x: 1, y: 1 }, // Force scale to 1 for export
  });

  // Clone all layers except those with non-exportable content
  layers.forEach((originalLayer: Konva.Layer) => {
    const layerName = originalLayer.name?.() || '';
    
    // Skip layers with non-exportable content
    if (layerName.includes('grip') || 
        layerName.includes('selection') || 
        layerName.includes('hover') ||
        layerName.includes('grid') && !includeGrid) {
      return;
    }
    
    const newLayer = originalLayer.clone({
      listening: false,
    });
    
    // Remove any nodes with exportable=false attribute
    newLayer.find('*').forEach((node: any) => {
      if (node.getAttr?.('exportable') === false) {
        node.destroy();
      }
    });
    
    exportStage.add(newLayer);
  });

  // Calculate connection paths
  const connectionPaths = calculateManualPathsWithBridges(connections, items);
  
  // Create a new layer for connections
  const connectionLayer = new Konva.Layer();
  
  // Render connections
  connections.forEach(connection => {
    const pathData = connectionPaths[connection.id]?.pathData;
    if (!pathData) return;

    const arrowAngle = connectionPaths[connection.id]?.arrowAngle || 0;
    const endPoint = connectionPaths[connection.id]?.endPoint;
    
    // Create the connection line
    const line = new Konva.Path({
      data: pathData,
      stroke: '#3b82f6', // Blue color
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    });
    connectionLayer.add(line);

    // Add arrow head
    if (endPoint) {
      const arrow = new Konva.Arrow({
        points: [
          endPoint.x - Math.cos(arrowAngle) * 10,
          endPoint.y - Math.sin(arrowAngle) * 10,
          endPoint.x,
          endPoint.y
        ],
        pointerLength: 8,
        pointerWidth: 8,
        fill: '#3b82f6',
        stroke: '#3b82f6',
        strokeWidth: 2,
        listening: false,
      });
      connectionLayer.add(arrow);
    }
  });
  
  // Add connection layer to stage
  if (connections.length > 0) {
    exportStage.add(connectionLayer);
  }

  return { stage: exportStage, container };
}

/* -------------------------------------------
   IMAGE EXPORT (PNG / JPG) - DEBUGGED VERSION
-------------------------------------------- */
export async function exportToImage(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[],
  connections: Connection[] = []
): Promise<Blob> {
  if (!items.length && !connections.length) {
    throw new Error('Nothing to export');
  }

  const padding = options.padding ?? 20; // Reduced padding
  const bounds = getContentBounds(items, connections);
  
  console.log('Export bounds:', bounds);
  console.log('Item count:', items.length);
  console.log('Connection count:', connections.length);

  // Create export stage
  const { stage: exportStage, container } = createExportStage(
    stage,
    items,
    connections,
    options.showGrid || options.includeGrid
  );

  try {
    // Add background layer
    const bgLayer = new Konva.Layer({ listening: false });
    const bgRect = new Konva.Rect({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fill: options.backgroundColor === 'transparent' 
        ? '#ffffff' 
        : options.backgroundColor,
      listening: false,
    });
    bgLayer.add(bgRect);
    exportStage.add(bgLayer);
    bgLayer.moveToBottom();

    exportStage.draw();

    // Debug: Log what we're about to export
    console.log('Export area:', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      scale: options.scale,
      bounds
    });

    // Export the exact area - no additional padding in toDataURL
    const dataUrl = exportStage.toDataURL({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      pixelRatio: options.scale || 1, // Use specified scale, default to 1
      mimeType: options.format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: options.format === 'jpg' 
        ? options.quality === 'high' ? 0.95 
          : options.quality === 'medium' ? 0.8 
          : 0.6 
        : undefined,
    });

    // Cleanup
    exportStage.destroy();
    if (container.parentNode) {
      document.body.removeChild(container);
    }

    // Convert to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    console.log('Export successful, blob size:', blob.size);
    return blob;
  } catch (error) {
    console.error('Export error:', error);
    // Ensure cleanup even on error
    exportStage.destroy();
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw error;
  }
}

/* -------------------------------------------
   PDF EXPORT - SIMPLIFIED
-------------------------------------------- */
export async function exportToPDF(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[],
  connections: Connection[] = []
): Promise<Blob> {
  // For PDF, use a higher scale
  const imageBlob = await exportToImage(
    stage,
    { 
      ...options, 
      format: 'png',
      scale: (options.scale || 1) * 2, // Double the scale for PDF
      showGrid: false, // Don't show grid in PDF
    },
    items,
    connections
  );

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate PDF dimensions (convert pixels to mm)
        const mmPerInch = 25.4;
        const pixelsPerInch = 96; // Standard screen DPI
        const mmWidth = (img.width / pixelsPerInch) * mmPerInch;
        const mmHeight = (img.height / pixelsPerInch) * mmPerInch;
        
        // Create PDF with calculated dimensions
        const pdf = new jsPDF({
          orientation: mmWidth > mmHeight ? 'l' : 'p',
          unit: 'mm',
          format: [mmWidth, mmHeight],
        });

        // Add image to fill the PDF
        pdf.addImage(img, 'PNG', 0, 0, mmWidth, mmHeight);
        const pdfBlob = pdf.output('blob');
        URL.revokeObjectURL(imageUrl);
        resolve(pdfBlob);
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Failed to load image for PDF export'));
    };
    
    img.src = imageUrl;
  });
}

/* -------------------------------------------
   MAIN EXPORT FUNCTION - SIMPLIFIED
-------------------------------------------- */
export async function exportDiagram(
  stage: Konva.Stage | null,
  items: CanvasItem[],
  options: ExportOptions & { connections?: Connection[] }
): Promise<Blob> {
  if (!stage) {
    throw new Error('Stage not available');
  }

  if (!items.length && !options.connections?.length) {
    throw new Error('No items to export');
  }

  // Get connections from options or use empty array
  const connections = options.connections || [];
  
  // Remove SVG support as requested
  switch (options.format) {
    case 'png':
    case 'jpg':
      return await exportToImage(stage, options, items, connections);
    
    case 'pdf':
      return await exportToPDF(stage, options, items, connections);
    
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/* -------------------------------------------
   DOWNLOAD HELPERS
-------------------------------------------- */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}