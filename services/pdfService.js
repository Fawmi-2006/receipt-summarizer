const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
    static createReceiptPDF(summary, filename) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 0 });
                const pdfPath = path.join('pdfs', filename);
                const stream = fs.createWriteStream(pdfPath);
                
                doc.pipe(stream);
                
                this.addModernBackground(doc);
                
                const contentX = 40;
                const contentWidth = doc.page.width - 80;
                
                this.addModernHeader(doc, contentX, contentWidth, 'RECEIPT SUMMARY');
                doc.y += 30;
                
                this.addReceiptContent(doc, summary, contentX, contentWidth);
                this.addModernFooter(doc, contentX, contentWidth);
                
                doc.end();

                stream.on('finish', () => resolve(pdfPath));
                stream.on('error', (error) => reject(error));

            } catch (error) {
                reject(error);
            }
        });
    }

    static createCombinedPDF(summaries, filename) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 0 });
                const pdfPath = path.join('pdfs', filename);
                const stream = fs.createWriteStream(pdfPath);
                
                doc.pipe(stream);
                
                this.addModernBackground(doc);
                
                const contentX = 40;
                const contentWidth = doc.page.width - 80;
                
                this.addCoverPage(doc, contentX, contentWidth, summaries.length);
                
                doc.addPage();
                this.addModernBackground(doc);
                this.addSummaryDashboard(doc, contentX, contentWidth, summaries);
                
                summaries.forEach((result, index) => {
                    doc.addPage();
                    this.addModernBackground(doc);
                    this.addReceiptDetailPage(doc, contentX, contentWidth, result, index + 1);
                });
                
                doc.end();

                stream.on('finish', () => resolve(pdfPath));
                stream.on('error', (error) => reject(error));

            } catch (error) {
                reject(error);
            }
        });
    }

    static addModernBackground(doc) {
        const gradient = doc.linearGradient(0, 0, doc.page.width, doc.page.height);
        gradient.stop(0, '#f8fafc');
        gradient.stop(1, '#f1f5f9');
        
        doc.rect(0, 0, doc.page.width, doc.page.height)
           .fill(gradient);
        
        doc.fillColor('#e0f2fe');
        doc.circle(doc.page.width - 100, 100, 80).fill();
        doc.circle(50, doc.page.height - 100, 60).fill();
        
        doc.fillColor('#f0fdf4');
        doc.circle(200, doc.page.height - 150, 40).fill();
    }

    static addModernHeader(doc, x, width, title) {
        doc.fillColor('#ffffff')
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .roundedRect(x, 40, width, 80, 12)
           .fill()
           .stroke();
        
        doc.fillColor('#1e40af')
           .fontSize(28)
           .font('Helvetica-Bold')
           .text(title, x + 30, 65, {
               width: width - 60,
               align: 'center'
           });
        
        doc.fillColor('#3b82f6')
           .rect(x + width/2 - 40, 110, 80, 3)
           .fill();
        
        doc.y = 130;
    }

    static addCoverPage(doc, x, width, receiptCount) {
        doc.fillColor('#1e40af')
           .fontSize(42)
           .font('Helvetica-Bold')
           .text('RECEIPT', x, 150, {
               width: width,
               align: 'center'
           });
        
        doc.fillColor('#3b82f6')
           .fontSize(36)
           .font('Helvetica-Bold')
           .text('PORTFOLIO', x, 200, {
               width: width,
               align: 'center'
           });
        
        const centerX = doc.page.width / 2;
        const centerY = 400;
        
        doc.fillColor('#ffffff')
           .strokeColor('#3b82f6')
           .lineWidth(3)
           .circle(centerX, centerY, 80)
           .fill()
           .stroke();
        
        doc.fillColor('#3b82f6')
           .circle(centerX, centerY, 60)
           .fill();
        
        doc.fillColor('#ffffff')
           .fontSize(32)
           .font('Helvetica-Bold')
           .text(receiptCount.toString(), centerX - 15, centerY - 15);
        
        doc.fillColor('#ffffff')
           .fontSize(12)
           .font('Helvetica')
           .text('Receipts', centerX - 25, centerY + 20);
        
        this.addFloatingIcons(doc);
        
        doc.fillColor('#64748b')
           .fontSize(14)
           .font('Helvetica')
           .text('AI-Powered Receipt Analysis', x, doc.page.height - 100, {
               width: width,
               align: 'center'
           });
        
        doc.fillColor('#94a3b8')
           .fontSize(12)
           .font('Helvetica')
           .text(`Generated on ${new Date().toLocaleDateString()}`, x, doc.page.height - 70, {
               width: width,
               align: 'center'
           });
    }

    static addSummaryDashboard(doc, x, width, summaries) {
        this.addModernHeader(doc, x, width, 'DASHBOARD OVERVIEW');
        
        const grandTotal = summaries.reduce((total, result) => {
            return total + (parseFloat(result.summary.totals?.total) || 0);
        }, 0);
        
        const totalItems = summaries.reduce((count, result) => {
            return count + (result.summary.items?.length || 0);
        }, 0);
        
        const stats = [
            {
                title: 'Total Receipts',
                value: summaries.length,
                color: '#3b82f6',
                icon: '📊',
                subtitle: 'Processed'
            },
            {
                title: 'Grand Total',
                value: `$${grandTotal.toFixed(2)}`,
                color: '#10b981',
                icon: '💰',
                subtitle: 'Total Spent'
            },
            {
                title: 'Total Items',
                value: totalItems,
                color: '#f59e0b',
                icon: '🛒',
                subtitle: 'Purchased'
            }
        ];
        
        const cardWidth = (width - 40) / 3;
        const cardY = doc.y + 20;
        
        stats.forEach((stat, index) => {
            const cardX = x + (index * (cardWidth + 20));
            this.addStatCard(doc, cardX, cardY, cardWidth, 120, stat);
        });
        
        doc.y = cardY + 150;
        
        this.addSectionHeader(doc, x, 'RECEIPT BREAKDOWN');
        
        const tableY = doc.y + 10;
        this.addReceiptsTable(doc, x, tableY, width, summaries);
        
        doc.y = tableY + (summaries.length * 25) + 40;
        
        this.addSpendingChart(doc, x, doc.y, width, 120, summaries);
    }

    static addStatCard(doc, x, y, width, height, stat) {
        doc.fillColor('#ffffff')
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .roundedRect(x, y, width, height, 16)
           .fill()
           .stroke();
        
        doc.fillColor(stat.color)
           .fontSize(24)
           .text(stat.icon, x + 20, y + 20);
        
        doc.fillColor('#1e293b')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text(stat.value, x + 60, y + 20);
        
        doc.fillColor('#64748b')
           .fontSize(12)
           .font('Helvetica')
           .text(stat.title, x + 60, y + 45);
        
        doc.fillColor('#94a3b8')
           .fontSize(10)
           .font('Helvetica')
           .text(stat.subtitle, x + 20, y + height - 25);
    }

    static addReceiptsTable(doc, x, y, width, summaries) {
        const colWidths = {
            merchant: width * 0.4,
            date: width * 0.25,
            total: width * 0.2,
            items: width * 0.15
        };
        
        doc.fillColor('#475569')
           .fontSize(10)
           .font('Helvetica-Bold');
        
        doc.text('MERCHANT', x, y);
        doc.text('DATE', x + colWidths.merchant, y);
        doc.text('TOTAL', x + colWidths.merchant + colWidths.date, y);
        doc.text('ITEMS', x + colWidths.merchant + colWidths.date + colWidths.total, y);
        
        doc.strokeColor('#e2e8f0')
           .lineWidth(1)
           .moveTo(x, y + 15)
           .lineTo(x + width, y + 15)
           .stroke();
        
        let currentY = y + 25;
        
        summaries.forEach((result, index) => {
            const summary = result.summary;
            const merchantName = summary.merchant?.name || 'Unknown Merchant';
            const date = summary.transaction?.date || 'N/A';
            const total = summary.totals?.total ? `$${parseFloat(summary.totals.total).toFixed(2)}` : '$0.00';
            const itemCount = summary.items?.length || 0;
            
            if (index % 2 === 0) {
                doc.fillColor('#f8fafc')
                   .rect(x, currentY - 5, width, 20)
                   .fill();
            }
            
            doc.fillColor('#1e293b')
               .fontSize(9)
               .font('Helvetica');
            
            doc.text(merchantName, x, currentY, {
                width: colWidths.merchant - 10,
                ellipsis: true
            });
            
            doc.text(date, x + colWidths.merchant, currentY, {
                width: colWidths.date
            });
            
            doc.text(total, x + colWidths.merchant + colWidths.date, currentY, {
                width: colWidths.total,
                align: 'right'
            });
            
            doc.text(itemCount.toString(), x + colWidths.merchant + colWidths.date + colWidths.total, currentY, {
                width: colWidths.items,
                align: 'center'
            });
            
            currentY += 20;
        });
        
        doc.y = currentY;
    }

    static addSpendingChart(doc, x, y, width, height, summaries) {
        this.addSectionHeader(doc, x, 'SPENDING DISTRIBUTION');
        
        doc.fillColor('#ffffff')
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .roundedRect(x, y + 30, width, height, 12)
           .fill()
           .stroke();
        
        const maxAmount = Math.max(...summaries.map(s => parseFloat(s.summary.totals?.total) || 0));
        const barWidth = (width - 40) / summaries.length;
        const chartHeight = height - 60;
        
        summaries.forEach((result, index) => {
            const summary = result.summary;
            const amount = parseFloat(summary.totals?.total) || 0;
            const barHeight = (amount / maxAmount) * chartHeight;
            const barX = x + 20 + (index * barWidth);
            const barY = y + 30 + chartHeight - barHeight + 20;
            
            doc.fillColor('#3b82f6')
               .roundedRect(barX, barY, barWidth - 10, barHeight, 4)
               .fill();
            
            if (barHeight > 20) {
                doc.fillColor('#ffffff')
                   .fontSize(8)
                   .font('Helvetica-Bold')
                   .text(`$${amount.toFixed(0)}`, barX, barY + barHeight/2 - 5, {
                       width: barWidth - 10,
                       align: 'center'
                   });
            }
            
            const merchantName = summary.merchant?.name || 'U';
            doc.fillColor('#64748b')
               .fontSize(7)
               .font('Helvetica-Bold')
               .text(merchantName.charAt(0).toUpperCase(), barX, y + 30 + chartHeight + 25, {
                   width: barWidth - 10,
                   align: 'center'
               });
        });
        
        doc.y = y + height + 50;
    }

    static addReceiptDetailPage(doc, x, width, result, receiptNumber) {
        const summary = result.summary;
        
        this.addModernHeader(doc, x, width, `RECEIPT #${receiptNumber}`);
        
        doc.fillColor('#ffffff')
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .roundedRect(x, doc.y, width, 100, 16)
           .fill()
           .stroke();
        
        const merchantName = summary.merchant?.name || 'Unknown Merchant';
        const date = summary.transaction?.date || 'Unknown Date';
        const total = summary.totals?.total ? `$${parseFloat(summary.totals.total).toFixed(2)}` : '$0.00';
        
        doc.fillColor('#1e40af')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text(merchantName, x + 30, doc.y + 25);
        
        doc.fillColor('#64748b')
           .fontSize(12)
           .font('Helvetica')
           .text(date, x + 30, doc.y + 50);
        
        doc.fillColor('#10b981')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text(total, x + width - 100, doc.y + 30);
        
        doc.y += 120;
        
        if (summary.items && summary.items.length > 0) {
            this.addSectionHeader(doc, x, 'PURCHASED ITEMS');
            this.addItemsTableModern(doc, x, doc.y + 10, width, summary.items);
            doc.y += (summary.items.length * 18) + 30;
        }
        
        if (summary.totals) {
            this.addSectionHeader(doc, x, 'TRANSACTION TOTALS');
            this.addTotalsModern(doc, x, doc.y + 10, width - 200, 200, summary.totals);
        }
    }

    static addItemsTableModern(doc, x, y, width, items) {
        const colWidths = {
            name: width * 0.6,
            quantity: width * 0.1,
            price: width * 0.15,
            total: width * 0.15
        };
        
        doc.fillColor('#475569')
           .fontSize(10)
           .font('Helvetica-Bold');
        
        doc.text('ITEM NAME', x, y);
        doc.text('QTY', x + colWidths.name, y);
        doc.text('PRICE', x + colWidths.name + colWidths.quantity, y);
        doc.text('TOTAL', x + colWidths.name + colWidths.quantity + colWidths.price, y);
        
        let currentY = y + 20;
        
        items.forEach((item, index) => {
            if (index % 2 === 0) {
                doc.fillColor('#f8fafc')
                   .rect(x, currentY - 8, width, 18)
                   .fill();
            }
            
            doc.fillColor('#1e293b')
               .fontSize(9)
               .font('Helvetica');
            
            doc.text(item.name || 'Unknown Item', x + 10, currentY, {
                width: colWidths.name - 20,
                ellipsis: true
            });
            
            doc.text(String(item.quantity || 1), x + colWidths.name, currentY, {
                width: colWidths.quantity,
                align: 'center'
            });
            
            doc.text(`$${parseFloat(item.price || 0).toFixed(2)}`, x + colWidths.name + colWidths.quantity, currentY, {
                width: colWidths.price,
                align: 'right'
            });
            
            doc.text(`$${parseFloat(item.total || 0).toFixed(2)}`, x + colWidths.name + colWidths.quantity + colWidths.price, currentY, {
                width: colWidths.total - 10,
                align: 'right'
            });
            
            currentY += 18;
        });
        
        doc.y = currentY + 10;
    }

    static addTotalsModern(doc, x, y, width, valueWidth, totals) {
        const startX = x + width;
        
        doc.fillColor('#1e293b')
           .fontSize(10)
           .font('Helvetica');
        
        if (totals.subtotal) {
            doc.text('Subtotal:', startX, y, { continued: true });
            doc.text(`$${parseFloat(totals.subtotal).toFixed(2)}`, startX + valueWidth, y, { align: 'right' });
            y += 15;
        }
        
        if (totals.tax_amount) {
            doc.text('Tax:', startX, y, { continued: true });
            doc.text(`$${parseFloat(totals.tax_amount).toFixed(2)}`, startX + valueWidth, y, { align: 'right' });
            y += 15;
        }
        
        if (totals.discount) {
            doc.text('Discount:', startX, y, { continued: true });
            doc.text(`-$${parseFloat(totals.discount).toFixed(2)}`, startX + valueWidth, y, { align: 'right' });
            y += 15;
        }
        
        doc.strokeColor('#e2e8f0')
           .lineWidth(1)
           .moveTo(startX, y + 5)
           .lineTo(startX + valueWidth, y + 5)
           .stroke();
        
        y += 10;
        
        if (totals.total) {
            doc.fillColor('#10b981')
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('TOTAL:', startX, y, { continued: true });
            doc.text(`$${parseFloat(totals.total).toFixed(2)}`, startX + valueWidth, y, { align: 'right' });
        }
        
        doc.y = Math.max(doc.y, y + 30);
    }

    static addReceiptContent(doc, summary, x, width) {
        doc.fillColor('#ffffff')
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .roundedRect(x, doc.y, width, 80, 16)
           .fill()
           .stroke();
        
        const merchantName = summary.merchant?.name || 'Unknown Merchant';
        const date = summary.transaction?.date || 'Unknown Date';
        const total = summary.totals?.total ? `$${parseFloat(summary.totals.total).toFixed(2)}` : '$0.00';
        
        doc.fillColor('#1e40af')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text(merchantName, x + 30, doc.y + 25);
        
        doc.fillColor('#64748b')
           .fontSize(12)
           .font('Helvetica')
           .text(date, x + 30, doc.y + 50);
        
        doc.fillColor('#10b981')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text(total, x + width - 100, doc.y + 30);
        
        doc.y += 100;
        
        if (summary.items && summary.items.length > 0) {
            this.addSectionHeader(doc, x, 'PURCHASED ITEMS');
            this.addItemsTableModern(doc, x, doc.y + 10, width, summary.items);
        }
    }

    static addSectionHeader(doc, x, text) {
        doc.fillColor('#374151')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(text, x, doc.y);
        
        doc.moveDown(0.5);
    }

    static addFloatingIcons(doc) {
        const icons = ['💰', '🧾', '📊', '🛒', '🏪'];
        const positions = [
            { x: 100, y: 300 },
            { x: doc.page.width - 150, y: 200 },
            { x: 150, y: doc.page.height - 200 },
            { x: doc.page.width - 100, y: doc.page.height - 150 },
            { x: doc.page.width / 2, y: 500 }
        ];
        
        positions.forEach((pos, index) => {
            doc.fillColor('#e0f2fe')
               .fontSize(24)
               .text(icons[index], pos.x, pos.y);
        });
    }

    static addModernFooter(doc, x, width) {
        const footerY = doc.page.height - 60;
        
        doc.fillColor('#64748b')
           .fontSize(10)
           .font('Helvetica')
           .text('Generated by ReceiptAI • Intelligent Document Processing', x, footerY, {
               width: width,
               align: 'center'
           });
        
        doc.fillColor('#94a3b8')
           .fontSize(9)
           .font('Helvetica')
           .text(new Date().toLocaleString(), x, footerY + 15, {
               width: width,
               align: 'center'
           });
    }
}

module.exports = PDFService;