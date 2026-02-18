// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateIntentPDF = async (intentData) => {
  const pdf = new jsPDF();
  
  // Add content to PDF
  pdf.text(`Purchase Intent - ${intentData.intentNumber}`, 20, 20);
  pdf.text(`Generated: ${new Date(intentData.generatedAt).toLocaleString()}`, 20, 30);
  pdf.text(`Total Items: ${intentData.totalItems}`, 20, 40);
  pdf.text(`Total Cost: $${intentData.totalCost.toFixed(2)}`, 20, 50);
  
  // Add table headers
  pdf.text('SKU', 20, 70);
  pdf.text('Description', 60, 70);
  pdf.text('Qty', 120, 70);
  pdf.text('Cost', 140, 70);
  pdf.text('Total', 160, 70);
  
  // Add items
  let yPosition = 80;
  intentData.items.forEach((item, index) => {
    if (yPosition > 270) {
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.text(item.sku, 20, yPosition);
    pdf.text(item.productDescription.substring(0, 20), 60, yPosition);
    pdf.text(item.quantity.toString(), 120, yPosition);
    pdf.text(`$${item.cost}`, 140, yPosition);
    pdf.text(`$${(parseFloat(item.cost) * item.quantity).toFixed(2)}`, 160, yPosition);
    
    yPosition += 10;
  });
  
  return pdf;
};

export const sharePDFViaWhatsApp = async (pdf, filename) => {
  const pdfBlob = pdf.output('blob');
  // Note: WhatsApp sharing of PDF files directly is limited
  // This would typically involve uploading to a service first
  console.log('PDF generated:', filename);
  // For now, we'll use the print version as shown above
};