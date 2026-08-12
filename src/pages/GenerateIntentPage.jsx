import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import "./GenerateIntentPage.css"

const GenerateIntentPage = ({ items, boms, onBack, onGeneratePO, showNotification }) => {
  const [selectedType, setSelectedType] = useState('individual');
  const [selectedIndividualItems, setSelectedIndividualItems] = useState([]);
  const [selectedBomItems, setSelectedBomItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [intentData, setIntentData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bomSearchTerm, setBomSearchTerm] = useState('');
  const [intentHistory, setIntentHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [previewIntent, setPreviewIntent] = useState(null);
  const [showPreviewPopup, setShowPreviewPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
   const [showDeletePopup, setshowDeletePopup] = useState(false);
  const [deleteIntentid, setDeleteIntentid] = useState(null);

  const filteredIndividualItems = useMemo(() =>
    items.filter(item =>
      (item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_description?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !item.bom_id
    ), [items, searchTerm]
  );

  const filteredBomItems = useMemo(() =>
    items.filter(item =>
      (item.sku?.toLowerCase().includes(bomSearchTerm.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(bomSearchTerm.toLowerCase()) ||
        item.product_description?.toLowerCase().includes(bomSearchTerm.toLowerCase())) &&
      item.bom_id
    ), [items, bomSearchTerm]
  );

  const bomGroups = useMemo(() =>
    filteredBomItems.reduce((groups, item) => {
      const bomName = item.bom_name || 'Uncategorized';
      if (!groups[bomName]) {
        groups[bomName] = [];
      }
      groups[bomName].push(item);
      return groups;
    }, {}), [filteredBomItems]
  );

  const generateIntentNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INT-${year}${month}${day}-${random}`;
  };

  const getItemVendorInfo = (item) => {
    let vendors = [];
    try {
      vendors = item.vendors ? JSON.parse(item.vendors) : [];
    } catch (error) {
      console.error('Error parsing vendors:', error);
    }
    const primaryVendor = vendors.find(v => v.primary) || vendors[0];
    return {
      vendorName: primaryVendor?.name || 'No vendor',
      cost: primaryVendor?.cost || '0',
      orderLink: item.order_link || '',
      vendorId: primaryVendor?.id || ''
    };
  };

  const handleIndividualItemSelect = (item, checked) => {
    if (checked) {
      const existingItem = selectedIndividualItems.find(i => i.id === item.id);
      if (!existingItem) {
        const vendorInfo = getItemVendorInfo(item);
        setSelectedIndividualItems(prev => [...prev, {
          ...item,
          ...vendorInfo,
          quantity: 1,
          type: 'individual'
        }]);
      }
    } else {
      setSelectedIndividualItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const handleIndividualItemQuantityChange = (itemId, quantity) => {
    if (quantity < 1) return;
    setSelectedIndividualItems(prev =>
      prev.map(item => item.id === itemId ? { ...item, quantity } : item)
    );
  };

  const removeIndividualItem = (itemId) => {
    setSelectedIndividualItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleBomItemSelect = (item, checked) => {
    if (checked) {
      const existingItem = selectedBomItems.find(i => i.id === item.id);
      if (!existingItem) {
        const vendorInfo = getItemVendorInfo(item);
        setSelectedBomItems(prev => [...prev, {
          ...item,
          ...vendorInfo,
          quantity: 1,
          type: 'bom',
          bomName: item.bom_name
        }]);
      }
    } else {
      setSelectedBomItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const handleBomItemQuantityChange = (itemId, quantity) => {
    if (quantity < 1) return;
    setSelectedBomItems(prev =>
      prev.map(item => item.id === itemId ? { ...item, quantity } : item)
    );
  };

  const removeBomItem = (itemId) => {
    setSelectedBomItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSelectAllBomGroup = (bomName, items) => {
    const itemsToAdd = items.filter(item =>
      !selectedBomItems.some(selected => selected.id === item.id)
    );

    if (itemsToAdd.length > 0) {
      setSelectedBomItems(prev => [
        ...prev,
        ...itemsToAdd.map(item => {
          const vendorInfo = getItemVendorInfo(item);
          return {
            ...item,
            ...vendorInfo,
            quantity: 1,
            type: 'bom',
            bomName: item.bom_name
          };
        })
      ]);
    } else {
      const itemIds = items.map(item => item.id);
      setSelectedBomItems(prev => prev.filter(item => !itemIds.includes(item.id)));
    }
  };

  const isBomGroupFullySelected = (items) => {
    if (items.length === 0) return false;
    return items.every(item =>
      selectedBomItems.some(selected => selected.id === item.id)
    );
  };

  const isIndividualItemSelected = (itemId) => {
    return selectedIndividualItems.some(item => item.id === itemId);
  };

  const isBomItemSelected = (itemId) => {
    return selectedBomItems.some(item => item.id === itemId);
  };

  const saveIntentToHistory = async (intentData) => {
    try {
      const intentRecord = {
        intent_number: intentData.intentNumber,
        items: JSON.stringify(intentData.items),
        total_items: intentData.totalItems,
        total_quantity: intentData.totalQuantity,
        total_cost: intentData.totalCost,
        generated_at: intentData.generatedAt,
        status: 'draft'
      };

      const { error } = await supabase
        .from('intents')
        .insert([intentRecord]);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error saving intent history:', error);
      return false;
    }
  };

  const fetchIntentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('intents')
        .select('*')
        .order('generated_at', { ascending: false });

      if (error) throw error;

      const parsedData = (data || []).map(intent => {
        let items = [];
        try {
          items = intent.items ? JSON.parse(intent.items) : [];
        } catch (error) {
          console.error('Error parsing items for intent:', intent.intent_number, error);
          items = [];
        }

        return {
          ...intent,
          items: items,
          totalCost: parseFloat(intent.total_cost) || 0,
          totalItems: parseInt(intent.total_items) || 0,
          totalQuantity: parseInt(intent.total_quantity) || 0
        };
      });

      setIntentHistory(parsedData);
    } catch (error) {
      console.error('Error fetching intent history:', error);
      setIntentHistory([]);
    }
  };

  const generateIntent = async () => {
    if (isGenerating) return;

    if (selectedIndividualItems.length === 0 && selectedBomItems.length === 0) {
      showNotification('Please select at least one item', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      const allItems = [...selectedIndividualItems, ...selectedBomItems];

      const aggregatedItems = allItems.reduce((acc, item) => {
        const existing = acc.find(i => i.sku === item.sku);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({
            id: item.id,
            sku: item.sku,
            item_code: item.item_code,
            product_description: item.product_description,
            category: item.category,
            vendorName: item.vendorName,
            vendorId: item.vendorId,
            cost: item.cost,
            order_link: item.order_link,
            quantity: item.quantity
          });
        }
        return acc;
      }, []);

      const intentNumber = generateIntentNumber();
      const intentData = {
        intentNumber,
        items: aggregatedItems,
        generatedAt: new Date().toISOString(),
        totalItems: aggregatedItems.length,
        totalQuantity: aggregatedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalCost: aggregatedItems.reduce((sum, item) => sum + (parseFloat(item.cost) * item.quantity), 0)
      };

      const saved = await saveIntentToHistory(intentData);
      if (saved) {
        setIntentData(intentData);
        setShowSuccessPopup(true);
        await fetchIntentHistory();
        showNotification('Purchase intent generated successfully!', 'success');
      } else {
        showNotification('Error saving intent history. Intent was generated but not saved.', 'error');
        setIntentData(intentData);
        setShowSuccessPopup(true);
      }
    } catch (error) {
      console.error('Error generating intent:', error);
      showNotification('Error generating intent. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseIntentForPO = (intent) => {
    // Convert intent items to the format expected by PurchaseOrderPage
    const vendorsData = intent.items.reduce((acc, item) => {
      const vendorName = item.vendorName || 'Unknown Vendor';
      if (!acc[vendorName]) {
        acc[vendorName] = {
          vendorName: vendorName,
          items: []
        };
      }

      // Ensure all required fields are present with proper naming
      acc[vendorName].items.push({
        id: item.id || `temp-${Date.now()}-${Math.random()}`,
        sku: item.sku || '',
        itemCode: item.itemCode || item.item_code || '',
        productDescription: item.productDescription || item.product_description || '',
        category: item.category || '',
        unitCost: parseFloat(item.cost || 0),
        quantity: parseInt(item.quantity || 1),
        vendorName: vendorName,
        totalCost: (parseFloat(item.cost || 0) * parseInt(item.quantity || 1)).toFixed(2)
      });

      return acc;
    }, {});

    // Prepare the intent data in the format expected by PurchaseOrderPage
    const formattedIntentData = {
      intentNumber: intent.intentNumber || intent.intent_number,
      generatedAt: intent.generatedAt || intent.generated_at,
      totalItems: intent.totalItems || intent.total_items,
      totalQuantity: intent.totalQuantity || intent.total_quantity,
      totalCost: intent.totalCost || intent.total_cost,
      items: intent.items,
      vendorsData: Object.values(vendorsData)
    };

    if (onGeneratePO) {
      onGeneratePO(formattedIntentData);
    }
  };
///Delete Each Data in History///
  const handleDeleteIntent = async () => {

  try {
    const { error } = await supabase
      .from("intents")
      .delete()
      .eq("id", deleteIntentid);

    if (error) throw error;

    showNotification("Intent deleted successfully!", "success");

    fetchIntentHistory();
    setDeleteIntentid(null)
    setshowDeletePopup(false)

  } catch (error) {
    console.error("Error deleting intent:", error);

    showNotification(
      "Failed to delete intent",
      "error"
    );
  }
};
///Delete Each Data in History///

  const generatePDFForSharing = async (intentData, type = 'whatsapp') => {
    const printWindow = window.open('', '_blank');
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Intent - ${intentData.intentNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            color: #333;
          }
          .company-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid rgba(29, 29, 30, 0.59)
            padding-bottom: 15px;
          }
          .company-header h1 {
            color: #1846bc;
            margin: 0;
            font-size: 28px;
          }
          .company-header h2 {
            color: #555;
            margin: 5px 0;
            font-size: 18px;
          }
          .intent-header { 
            text-align: center; 
            margin-bottom: 20px;
          }
          .intent-header h3 { 
            color:  #1846bc; 
            margin: 0;
            font-size: 24px;
          }
          .intent-meta { 
            display: flex; 
            justify-content: space-between;
            margin-top: 15px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 5px;
          }
          .intent-table { 
            width: 100%; 
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          .intent-table th, .intent-table td { 
            border: 1px solid #ddd; 
            padding: 8px;
            text-align: left;
          }
          .intent-table th { 
            background-color:  #1846bc; 
            color: white;
            font-weight: bold;
          }
          .intent-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .total-row {
            font-weight: bold;
            background-color: #e9ecef !important;
          }
          .cost-column {
            text-align: right;
          }
          .quantity-column {
            text-align: center;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .intent-table { font-size: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="company-header">
          <h1>KINYA MEDICAL SYSTEM</h1>
          <h2>Purchase Department</h2>
        </div>
        <div class="intent-header">
          <h3>PURCHASE INTENT - ${intentData.intentNumber}</h3>
          <div class="intent-meta">
            <p><strong>Generated Date:</strong> ${new Date(intentData.generatedAt).toLocaleDateString()}</p>
            <p><strong>Total Items:</strong> ${intentData.totalItems}</p>
            <p><strong>Total Quantity:</strong> ${intentData.totalQuantity}</p>
            <p><strong>Total Cost:</strong> ₹${intentData.totalCost.toFixed(2)}</p>
          </div>
        </div>
        <table class="intent-table">
          <thead>
            <tr>
              <th>#</th>
              <th>SKU</th>
              <th>Item Code</th>
              <th>Product Description</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Unit Cost</th>
              <th>Quantity</th>
              <th>Total Cost</th>
              <th>Order Link</th>
            </tr>
          </thead>
          <tbody>
            ${intentData.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.sku}</td>
                <td>${item.itemCode || item.item_code}</td>
                <td>${item.productDescription || item.product_description}</td>
                <td>${item.category}</td>
                <td>${item.vendorName}</td>
                <td class="cost-column">₹${item.cost}</td>
                <td class="quantity-column">${item.quantity}</td>
                <td class="cost-column">₹${(parseFloat(item.cost) * item.quantity).toFixed(2)}</td>
                <td>${item.orderLink || item.order_link || 'N/A'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="6" style="text-align: right;"><strong>Grand Totals:</strong></td>
              <td class="cost-column"><strong>₹${intentData.items.reduce((sum, item) => sum + parseFloat(item.cost), 0).toFixed(2)}</strong></td>
              <td class="quantity-column"><strong>${intentData.totalQuantity}</strong></td>
              <td class="cost-column"><strong>₹${intentData.totalCost.toFixed(2)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 30px; text-align: center; color: #666;">
          <p>Generated on: ${new Date(intentData.generatedAt).toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(pdfContent);
    printWindow.document.close();

    if (type === 'whatsapp') {
      const message = `Purchase Intent ${intentData.intentNumber}\nTotal: ₹${intentData.totalCost.toFixed(2)}`;
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }

    printWindow.print();
  };

  const handleShareWhatsApp = () => {
    generatePDFForSharing(intentData, 'whatsapp');
  };

  const handleShareEmail = () => {
    const subject = `Purchase Intent ${intentData.intentNumber} - KINYA MEDICAL SYSTEM`;
    const body = `Please find the purchase intent attached.\n\nIntent Number: ${intentData.intentNumber}\nTotal Amount: ₹${intentData.totalCost.toFixed(2)}`;

    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleCopyToClipboard = () => {
    const text = `Purchase Intent - KINYA MEDICAL SYSTEM\n\n` +
      `Intent Number: ${intentData.intentNumber}\n` +
      `Generated: ${new Date(intentData.generatedAt).toLocaleString()}\n` +
      `Total Items: ${intentData.totalItems}\n` +
      `Total Quantity: ${intentData.totalQuantity}\n` +
      `Total Cost: ₹${intentData.totalCost.toFixed(2)}\n\n` +
      `Items:\n` +
      intentData.items.map((item, index) =>
        `${index + 1}. SKU: ${item.sku} | Code: ${item.itemCode || item.item_code} | ${item.productDescription || item.product_description} | Category: ${item.category} | Vendor: ${item.vendorName} | Cost: ₹${item.cost} | Qty: ${item.quantity} | Link: ${item.orderLink || item.order_link || 'N/A'}`
      ).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showNotification('Purchase intent copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      showNotification('Failed to copy to clipboard', 'error');
    });
  };

  const handlePrint = () => {
    generatePDFForSharing(intentData, 'print');
  };

  const handlePreviewIntent = (intent) => {
    console.log('Previewing intent:', intent);

    let items = [];
    try {
      if (Array.isArray(intent.items)) {
        items = intent.items;
      } else if (typeof intent.items === 'string') {
        items = JSON.parse(intent.items);
      }
    } catch (error) {
      console.error('Error parsing items for preview:', error);
      items = [];
    }

    const previewIntent = {
      intentNumber: intent.intent_number,
      generatedAt: intent.generated_at,
      totalItems: intent.total_items,
      totalQuantity: intent.total_quantity,
      totalCost: parseFloat(intent.total_cost) || 0,
      items: items.map(item => ({
        id: item.id || Math.random().toString(36).substr(2, 9),
        sku: item.sku || '',
        itemCode: item.itemCode || item.item_code || '',
        productDescription: item.productDescription || item.product_description || '',
        category: item.category || '',
        vendorName: item.vendorName || item.vendor_name || 'No Vendor',
        cost: item.cost || item.unitCost || '0',
        quantity: item.quantity || 1,
        orderLink: item.orderLink || item.order_link || ''
      }))
    };

    setPreviewIntent(previewIntent);
    setShowPreviewPopup(true);
  };

  const handleClosePreview = () => {
    setShowPreviewPopup(false);
    setPreviewIntent(null);
  };

  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
  };

  useEffect(() => {
    fetchIntentHistory();
  }, []);

  return (
    <div className="intent-page">
      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="intent-popup-overlay">
          <div className="intent-popup-content success-popup">
            <div className="intent-popup-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h3>Purchase Intent Generated Successfully!</h3>
            <p>Your purchase intent has been generated and saved to history.</p>
            <div className="intent-popup-actions">
              <button
                className="intent-btn intent-btn-primary"
                onClick={handleCloseSuccessPopup}
              >
                Continue
              </button>
              <button
                className="intent-btn intent-btn-secondary"
                onClick={() => {
                  handleCloseSuccessPopup();
                  setActiveTab('history');
                }}
              >
                View History
              </button>
            </div>
          </div>
        </div>
      )}
       
        {showDeletePopup && (
        <div className="intent-popup-overlay">
          <div className="intent-popup-content success-popup">
            <div className="intent-popup-icon delete">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3>Delete Intent</h3>
            <p>Are you sure you want to delete this Intent?</p>
            <div className="intent-popup-actions">
              <button
                className="intent-btn intent-btn-secondary"
                onClick={()=>{setDeleteIntentid(null);
                  setshowDeletePopup(false)
                }}
              >
                Cancel
              </button>
              <button
                className="intent-btn intent-btn-danger"
                onClick={handleDeleteIntent}
              >
               Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Popup */}
      {showPreviewPopup && previewIntent && (
        <div className="intent-popup-overlay">
          <div className="intent-popup-content preview-popup">
            <div className="intent-popup-header">
              <h3>
                <i className="fas fa-file-invoice"></i>
                Purchase Intent Preview - {previewIntent.intentNumber || 'N/A'}
              </h3>
              <button
                className="intent-popup-close"
                onClick={handleClosePreview}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="intent-popup-body">
              {previewIntent.items && previewIntent.items.length > 0 ? (
                <div className="intent-preview-content">
                  <div className="intent-company-header">
                    <h1>KINYA MEDICAL SYSTEM</h1>
                    <h2>Purchase Department</h2>
                    <h3>PURCHASE INTENT</h3>
                    <div className="intent-meta">
                      <p><i className="fas fa-calendar"></i> <strong>Generated Date:</strong> {new Date(previewIntent.generatedAt).toLocaleDateString()}</p>
                      <p><i className="fas fa-cube"></i> <strong>Total Items:</strong> {previewIntent.totalItems}</p>
                      <p><i className="fas fa-cubes"></i> <strong>Total Quantity:</strong> {previewIntent.totalQuantity}</p>
                      <p><i className="fas fa-rupee-sign"></i> <strong>Total Cost:</strong> ₹{(parseFloat(previewIntent.totalCost) || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="intent-table-container">
                    <table className="intent-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>SKU</th>
                          <th>Item Code</th>
                          <th>Product Description</th>
                          <th>Category</th>
                          <th>Vendor</th>
                          <th>Unit Cost</th>
                          <th>Quantity</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewIntent.items.map((item, index) => (
                          <tr key={item.id || index}>
                            <td>{index + 1}</td>
                            <td><strong>{item.sku}</strong></td>
                            <td>{item.itemCode}</td>
                            <td>{item.productDescription}</td>
                            <td><span className="intent-category-tag">{item.category}</span></td>
                            <td>{item.vendorName}</td>
                            <td className="intent-cost-column">₹{item.cost}</td>
                            <td className="intent-quantity-column"><span className="intent-quantity-badge">{item.quantity}</span></td>
                            <td className="intent-cost-column">₹{(parseFloat(item.cost) * (item.quantity || 1)).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="intent-total-row">
                          <td colSpan="6" style={{ textAlign: 'right' }}><strong>Grand Totals:</strong></td>
                          <td className="intent-cost-column">
                            <strong>
                              ₹{previewIntent.items.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0).toFixed(2)}
                            </strong>
                          </td>
                          <td className="intent-quantity-column">
                            <strong className="intent-total-quantity">{previewIntent.totalQuantity}</strong>
                          </td>
                          <td className="intent-cost-column">
                            <strong>₹{(parseFloat(previewIntent.totalCost) || 0).toFixed(2)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="intent-footer">
                    <p><i className="fas fa-clock"></i> Generated on: {new Date(previewIntent.generatedAt).toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <div className="intent-empty-preview">
                  <i className="fas fa-exclamation-triangle"></i>
                  <h4>No Items Found</h4>
                  <p>This purchase intent doesn't contain any items or the data is corrupted.</p>
                </div>
              )}
            </div>
            <div className="intent-popup-footer">
              <button
                className="intent-btn intent-btn-secondary"
                onClick={handleClosePreview}
              >
                <i className="fas fa-times"></i>
                Close
              </button>
              {previewIntent.items && previewIntent.items.length > 0 && (
                <button
                  className="intent-btn intent-btn-primary"
                  onClick={() => {
                    handleUseIntentForPO(previewIntent);
                    handleClosePreview();
                  }}
                >
                  <i className="fas fa-shopping-cart"></i>
                  Create Purchase Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="intent-header">
        <div className="intent-title-section">
          <h2><i className="fas fa-file-invoice-dollar"></i>Generate Purchase Intent</h2>
          <p>Select items to generate purchase intent document</p>
        </div>
      </div>

      <div className="intent-stats">
        <div className="intent-stat-card">
          <div className="intent-stat-icon orange">
            <i className="fas fa-cubes"></i>
          </div>
          <div className="intent-stat-info">
            <h3>{items.length}</h3>
            <p>Total Items</p>
          </div>
        </div>
        <div className="intent-stat-card">
          <div className="intent-stat-icon blue">
            <i className="fas fa-history"></i>
          </div>
          <div className="intent-stat-info">
            <h3>{intentHistory.length}</h3>
            <p>Saved Intents</p>
          </div>
        </div>
      </div>

      <div className="intent-tabs">
        <button
          className={`intent-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <i className="fas fa-plus-circle"></i>
          Create New Intent
        </button>
        <button
          className={`intent-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <i className="fas fa-history"></i>
          Intent History ({intentHistory.length})
        </button>
      </div>

      {activeTab === 'history' && (
        <div className="intent-history">
          <div className="intent-history-header">
            <h3><i className="fas fa-history"></i>Purchase Intent History</h3>
          </div>

          <div className="intent-table-container">
            <table className="intent-data-table">
              <thead>
                <tr>
                  <th>Intent Number</th>
                  <th>Generated Date</th>
                  <th>Total Items</th>
                  <th>Total Quantity</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {intentHistory.length > 0 ? (
                  intentHistory.map(intent => (
                    <tr key={intent.id}>
                      <td><strong>{intent.intent_number}</strong></td>
                      <td>{new Date(intent.generated_at).toLocaleDateString()}</td>
                      <td>{intent.total_items}</td>
                      <td>{intent.total_quantity}</td>
                      <td>₹{parseFloat(intent.total_cost || 0).toFixed(2)}</td>
                      <td>
                        <span className={`intent-status-badge status-${intent.status || 'draft'}`}>
                          {intent.status || 'Draft'}
                        </span>
                      </td>
                      <td>
                        <div className="intent-action-buttons">

                          {/* Preview Button */}
                          <button
                            className="intent-btn-icon view"
                            onClick={() => handlePreviewIntent(intent)}
                            title="Preview Intent"
                          >
                            <i className="fas fa-eye"></i>
                          </button>

                          {/* Delete Button */}
                          <button
                            className="intent-btn-icon delete"
                            onClick={() => {
                              setDeleteIntentid(intent.id);
                              setshowDeletePopup(true)
                            }}
                            title="Delete Intent"
                          >
                            <i className="fas fa-trash"></i>
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="intent-empty-table-message">
                      <div className="intent-empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>No Purchase Intents</h3>
                        <p>Create your first purchase intent to get started</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'create' && !intentData && (
        <>
          <div className="intent-type-selector">
            <button
              className={`intent-type-btn ${selectedType === 'individual' ? 'active' : ''}`}
              onClick={() => setSelectedType('individual')}
            >
              <i className="fas fa-cube"></i>
              Individual Items
            </button>
            <button
              className={`intent-type-btn ${selectedType === 'bom' ? 'active' : ''}`}
              onClick={() => setSelectedType('bom')}
            >
              <i className="fas fa-sitemap"></i>
              BOM Items
            </button>
          </div>

          <div className="intent-search-section">
            <div className="intent-search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder={`Search ${selectedType === 'individual' ? 'individual items' : 'BOM items'}...`}
                value={selectedType === 'individual' ? searchTerm : bomSearchTerm}
                onChange={(e) => selectedType === 'individual' ? setSearchTerm(e.target.value) : setBomSearchTerm(e.target.value)}
                className="intent-search-input"
              />
            </div>
          </div>

          {selectedType === 'individual' && (
            <div className="intent-selection-section">
              <div className="intent-section-header">
                <h3><i className="fas fa-cube"></i>Select Individual Items ({filteredIndividualItems.length})</h3>
              </div>
              <div className="intent-table-container">
                <table className="intent-selection-table">
                  <thead>
                    <tr>
                      <th width="50px">Select</th>
                      <th>SKU</th>
                      <th>Item Code</th>
                      <th>Product Description</th>
                      <th>Category</th>
                      <th>Vendor</th>
                      <th>Cost</th>
                      <th>Order Link</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndividualItems.length > 0 ? (
                      filteredIndividualItems.map(item => {
                        const isSelected = isIndividualItemSelected(item.id);
                        const selectedItem = selectedIndividualItems.find(i => i.id === item.id);
                        const vendorInfo = getItemVendorInfo(item);

                        return (
                          <tr key={item.id} className={isSelected ? 'selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleIndividualItemSelect(item, e.target.checked)}
                              />
                            </td>
                            <td>{item.sku}</td>
                            <td>{item.item_code}</td>
                            <td>{item.product_description}</td>
                            <td>{item.category}</td>
                            <td>{vendorInfo.vendorName}</td>
                            <td>₹{vendorInfo.cost}</td>
                            <td className="intent-truncate">{item.order_link || 'N/A'}</td>
                            <td>
                              {isSelected ? (
                                <div className="intent-quantity-control">
                                  <button onClick={() => handleIndividualItemQuantityChange(item.id, selectedItem.quantity - 1)}>
                                    <i className="fas fa-minus"></i>
                                  </button>
                                  <span>{selectedItem.quantity}</span>
                                  <button onClick={() => handleIndividualItemQuantityChange(item.id, selectedItem.quantity + 1)}>
                                    <i className="fas fa-plus"></i>
                                  </button>
                                </div>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" className="intent-empty-table-message">
                          <p className="intent-no-items">No individual items found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedType === 'bom' && (
            <div className="intent-selection-section">
              <div className="intent-section-header">
                <h3><i className="fas fa-sitemap"></i>Select BOM Items ({filteredBomItems.length})</h3>
              </div>
              <div className="intent-bom-groups">
                {Object.keys(bomGroups).length > 0 ? (
                  Object.keys(bomGroups).map(bomName => {
                    const itemsInGroup = bomGroups[bomName];
                    const isGroupFullySelected = isBomGroupFullySelected(itemsInGroup);

                    return (
                      <div key={bomName} className="intent-bom-group">
                        <div className="intent-bom-group-header">
                          <h4>
                            <i className="fas fa-sitemap"></i>
                            {bomName} ({itemsInGroup.length} items)
                          </h4>
                          <button
                            className={`intent-btn ${isGroupFullySelected ? 'intent-btn-secondary' : 'intent-btn-primary'} intent-btn-sm`}
                            onClick={() => handleSelectAllBomGroup(bomName, itemsInGroup)}
                          >
                            <i className={`fas ${isGroupFullySelected ? 'fa-times' : 'fa-check'}`}></i>
                            {isGroupFullySelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="intent-table-container">
                          <table className="intent-selection-table">
                            <thead>
                              <tr>
                                <th width="50px">Select</th>
                                <th>SKU</th>
                                <th>Item Code</th>
                                <th>Product Description</th>
                                <th>Category</th>
                                <th>Vendor</th>
                                <th>Cost</th>
                                <th>Order Link</th>
                                <th>Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsInGroup.map(item => {
                                const isSelected = isBomItemSelected(item.id);
                                const selectedItem = selectedBomItems.find(i => i.id === item.id);
                                const vendorInfo = getItemVendorInfo(item);

                                return (
                                  <tr key={item.id} className={isSelected ? 'selected' : ''}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => handleBomItemSelect(item, e.target.checked)}
                                      />
                                    </td>
                                    <td>{item.sku}</td>
                                    <td>{item.item_code}</td>
                                    <td>{item.product_description}</td>
                                    <td>{item.category}</td>
                                    <td>{vendorInfo.vendorName}</td>
                                    <td>₹{vendorInfo.cost}</td>
                                    <td className="intent-truncate">{item.order_link || 'N/A'}</td>
                                    <td>
                                      {isSelected ? (
                                        <div className="intent-quantity-control">
                                          <button onClick={() => handleBomItemQuantityChange(item.id, selectedItem.quantity - 1)}>
                                            <i className="fas fa-minus"></i>
                                          </button>
                                          <span>{selectedItem.quantity}</span>
                                          <button onClick={() => handleBomItemQuantityChange(item.id, selectedItem.quantity + 1)}>
                                            <i className="fas fa-plus"></i>
                                          </button>
                                        </div>
                                      ) : (
                                        <span>-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="intent-no-items">No BOM items found</p>
                )}
              </div>
            </div>
          )}

          {(selectedIndividualItems.length > 0 || selectedBomItems.length > 0) && (
            <div className="intent-selected-preview">
              <div className="intent-preview-header">
                <h3>
                  <i className="fas fa-shopping-cart"></i>
                  Selected Items Preview ({(selectedIndividualItems.length + selectedBomItems.length)})
                </h3>
                <div className="intent-selection-summary">
                  <div className="intent-summary-item">
                    <i className="fas fa-cube"></i>
                    <span>{selectedIndividualItems.length} Individual</span>
                  </div>
                  <div className="intent-summary-item">
                    <i className="fas fa-sitemap"></i>
                    <span>{selectedBomItems.length} BOM</span>
                  </div>
                  <div className="intent-summary-item">
                    <i className="fas fa-cubes"></i>
                    <span>
                      {[...selectedIndividualItems, ...selectedBomItems].reduce((sum, item) => sum + item.quantity, 0)} Total Qty
                    </span>
                  </div>
                  <div className="intent-summary-item">
                    <i className="fas fa-rupee-sign"></i>
                    <span>
                      ₹{[...selectedIndividualItems, ...selectedBomItems].reduce((sum, item) => sum + (parseFloat(item.cost) * item.quantity), 0).toFixed(2)} Total Cost
                    </span>
                  </div>
                </div>
              </div>

              <div className="intent-selected-items-table">
                <table className="intent-selection-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>SKU</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Vendor</th>
                      <th>Cost</th>
                      <th>Order Link</th>
                      <th>Quantity</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIndividualItems.map(item => (
                      <tr key={item.id}>
                        <td><span className="intent-type-badge individual">Individual</span></td>
                        <td>{item.sku}</td>
                        <td>{item.item_code}</td>
                        <td>{item.product_description}</td>
                        <td>{item.category}</td>
                        <td>{item.vendorName}</td>
                        <td>₹{item.cost}</td>
                        <td className="intent-truncate">{item.order_link || 'N/A'}</td>
                        <td>
                          <div className="intent-quantity-control">
                            <button onClick={() => handleIndividualItemQuantityChange(item.id, item.quantity - 1)}>
                              <i className="fas fa-minus"></i>
                            </button>
                            <span>{item.quantity}</span>
                            <button onClick={() => handleIndividualItemQuantityChange(item.id, item.quantity + 1)}>
                              <i className="fas fa-plus"></i>
                            </button>
                          </div>
                        </td>
                        <td>₹{(parseFloat(item.cost) * item.quantity).toFixed(2)}</td>
                        <td>
                          <button
                            className="intent-remove-btn"
                            onClick={() => removeIndividualItem(item.id)}
                            title="Remove item"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selectedBomItems.map(item => (
                      <tr key={item.id}>
                        <td><span className="intent-type-badge bom">BOM: {item.bomName}</span></td>
                        <td>{item.sku}</td>
                        <td>{item.item_code}</td>
                        <td>{item.product_description}</td>
                        <td>{item.category}</td>
                        <td>{item.vendorName}</td>
                        <td>₹{item.cost}</td>
                        <td className="intent-truncate">{item.order_link || 'N/A'}</td>
                        <td>
                          <div className="intent-quantity-control">
                            <button onClick={() => handleBomItemQuantityChange(item.id, item.quantity - 1)}>
                              <i className="fas fa-minus"></i>
                            </button>
                            <span>{item.quantity}</span>
                            <button onClick={() => handleBomItemQuantityChange(item.id, item.quantity + 1)}>
                              <i className="fas fa-plus"></i>
                            </button>
                          </div>
                        </td>
                        <td>₹{(parseFloat(item.cost) * item.quantity).toFixed(2)}</td>
                        <td>
                          <button
                            className="intent-remove-btn"
                            onClick={() => removeBomItem(item.id)}
                            title="Remove item"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="intent-generate-section">
                <button
                  className={`intent-generate-btn ${isGenerating ? 'loading' : ''}`}
                  onClick={generateIntent}
                  disabled={isGenerating}
                >
                  <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-file-invoice'}`}></i>
                  {isGenerating ? 'Generating...' : 'Generate Purchase Intent'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {intentData && (
        <div className="intent-preview">
          <div className="intent-preview-header">
            <h3><i className="fas fa-file-invoice"></i>Purchase Intent Preview - {intentData.intentNumber}</h3>
            <div className="intent-preview-actions">
              <button className="intent-print-btn" onClick={handlePrint}>
                <i className="fas fa-print"></i>
                Print Intent
              </button>
              <button className="intent-whatsapp-btn" onClick={handleShareWhatsApp}>
                <i className="fab fa-whatsapp"></i>
                Share via WhatsApp
              </button>
              <button className="intent-email-btn" onClick={handleShareEmail}>
                <i className="fas fa-envelope"></i>
                Share via Email
              </button>
              <button className="intent-copy-btn" onClick={handleCopyToClipboard}>
                <i className="fas fa-copy"></i>
                Copy to Clipboard
              </button>
              <button className="intent-back-btn" onClick={() => setIntentData(null)}>
                <i className="fas fa-arrow-left"></i>
                Back to Selection
              </button>
              <button className="intent-po-btn" onClick={() => handleUseIntentForPO(intentData)}>
                <i className="fas fa-shopping-cart"></i>
                Create Purchase Order
              </button>
              <button className="intent-back-btn" onClick={onBack}>
                <i className="fas fa-home"></i>
                Back to Main
              </button>
            </div>
          </div>

          <div className="intent-content">
            <div className="intent-company-header">
              <h1>KINYA MEDICAL SYSTEM</h1>
              <h2>Purchase Department</h2>
              <h3>PURCHASE INTENT</h3>
              <div className="intent-meta">
                <p><i className="fas fa-calendar"></i> <strong>Generated Date:</strong> {new Date(intentData.generatedAt).toLocaleDateString()}</p>
                <p><i className="fas fa-cube"></i> <strong>Total Items:</strong> {intentData.totalItems}</p>
                <p><i className="fas fa-cubes"></i> <strong>Total Quantity:</strong> {intentData.totalQuantity}</p>
                <p><i className="fas fa-rupee-sign"></i> <strong>Total Cost:</strong> ₹{intentData.totalCost.toFixed(2)}</p>
              </div>
            </div>

            <table className="intent-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SKU</th>
                  <th>Item Code</th>
                  <th>Product Description</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Unit Cost</th>
                  <th>Quantity</th>
                  <th>Total Cost</th>
                  <th>Order Link</th>
                </tr>
              </thead>
              <tbody>
                {intentData.items.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td><strong>{item.sku}</strong></td>
                    <td>{item.itemCode || item.item_code}</td>
                    <td>{item.productDescription || item.product_description}</td>
                    <td><span className="intent-category-tag">{item.category}</span></td>
                    <td>{item.vendorName}</td>
                    <td className="intent-cost-column">₹{item.cost}</td>
                    <td className="intent-quantity-column"><span className="intent-quantity-badge">{item.quantity}</span></td>
                    <td className="intent-cost-column">₹{(parseFloat(item.cost) * item.quantity).toFixed(2)}</td>
                    <td className="intent-truncate">{item.orderLink || item.order_link || 'N/A'}</td>
                  </tr>
                ))}
                <tr className="intent-total-row">
                  <td colSpan="6" style={{ textAlign: 'right' }}><strong>Grand Totals:</strong></td>
                  <td className="intent-cost-column"><strong>₹{intentData.items.reduce((sum, item) => sum + parseFloat(item.cost), 0).toFixed(2)}</strong></td>
                  <td className="intent-quantity-column"><strong className="intent-total-quantity">{intentData.totalQuantity}</strong></td>
                  <td className="intent-cost-column"><strong>₹{intentData.totalCost.toFixed(2)}</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div className="intent-footer">
              <p><i className="fas fa-clock"></i> Generated on: {new Date(intentData.generatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateIntentPage;