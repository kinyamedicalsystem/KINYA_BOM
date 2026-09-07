import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import "./PurchaseOrderPage.css"

const PurchaseOrderPage = ({ vendors, items, onBack, intentData, showNotification }) => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [poItems, setPoItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [poData, setPoData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [availableIntents, setAvailableIntents] = useState([]);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [intentVendors, setIntentVendors] = useState([]);
  const [currentVendorIndex, setCurrentVendorIndex] = useState(0);
  
  // Popup states
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupAction, setPopupAction] = useState(null);

  const [formData, setFormData] = useState({
    poDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    notes: '',
    terms: 'Net 30 days',
    taxRate: 0
  });


  const showConfirm = (message, action) => {
    setPopupMessage(message);
    setPopupAction(() => action);
    setShowConfirmPopup(true);
  };

  const approvedVendors = useMemo(() => 
    vendors.filter(vendor => vendor.status === 'Approved'), 
    [vendors]
  );

  //Fetch Available Intent for PO it from Intent Database
  const fetchAvailableIntents = async () => {
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
          console.error('Error parsing items for intent:', error);
        }
        
        return {
          ...intent,
          items: items
        };
      });
      
      setAvailableIntents(parsedData);
    } catch (error) {
      console.error('Error fetching intents:', error);
      setAvailableIntents([]);
    }
  };

  
  const groupIntentItemsByVendor = (intentItems) => {
    if (!intentItems || !Array.isArray(intentItems)) {
      return [];
    }
   
    const vendorsMap = {};
    intentItems.forEach(item => {
      const vendorName = item.vendorName || item.vendor_name || 'Unknown Vendor';
      if (!vendorsMap[vendorName]) {
        vendorsMap[vendorName] = {
          vendorName: vendorName,
          items: [],
          totalCost: 0,
          totalQuantity: 0
        };
      }
      
      const cost = parseFloat(item.cost || item.unitCost || 0);
      const quantity = parseInt(item.quantity || 1);
      
      const itemData = {
        id: item.id || `temp-${Date.now()}-${Math.random()}`,
        sku: item.sku || '',
        itemCode: item.itemCode || item.item_code || '',
        productDescription: item.productDescription || item.product_description || '',
        category: item.category || '',
        unitCost: cost,
        quantity: quantity,
        vendorName: vendorName,
        totalCost: (cost * quantity).toFixed(2)
      };
        
      vendorsMap[vendorName].items.push(itemData);
      vendorsMap[vendorName].totalCost += cost * quantity;
      vendorsMap[vendorName].totalQuantity += quantity;
    });
    
    return Object.values(vendorsMap);
  };

  const handleIntentSelect = (intent) => {
    if (!intent) return;
    
    setSelectedIntent(intent);
    
    const vendorsData = groupIntentItemsByVendor(intent.items || []);
    setIntentVendors(vendorsData);
    
    if (vendorsData.length > 0) {
      const firstVendor = vendorsData[0];
      setSelectedVendor(firstVendor.vendorName);
      setPoItems(firstVendor.items);
      setCurrentVendorIndex(0);
    }
    
    setActiveTab('create');
    showNotification(`Intent ${intent.intent_number} loaded successfully!`);
  };

  useEffect(() => {
    if (intentData) {
      console.log('Intent data received:', intentData); // Debug log
      
      // Handle intent data from props
      if (intentData.vendorsData && Array.isArray(intentData.vendorsData)) {
        // Data is already grouped by vendor
        setSelectedIntent(intentData);
        setIntentVendors(intentData.vendorsData);
        
        if(intentData.vendorsData.length > 0) {
          const firstVendor = intentData.vendorsData[0];
          setSelectedVendor(firstVendor.vendorName);
          setPoItems(firstVendor.items || []);
          setCurrentVendorIndex(0);
        }
      } else if (intentData.items && Array.isArray(intentData.items)) {
        // Need to group items by vendor
        handleIntentSelect(intentData);
      } else if (intentData.intentNumber || intentData.intent_number) {
        // Try to handle as intent object
        handleIntentSelect(intentData);
      }
    }
  }, [intentData]);

  useEffect(() => {
    fetchAvailableIntents();
  }, []);

  const getVendorInfo = (vendorName) => {
    return approvedVendors.find(v => v.vendor_name === vendorName);
  };

  const handleVendorChange = (vendorName) => {
    setSelectedVendor(vendorName);
    const vendorIndex = intentVendors.findIndex(v => v.vendorName === vendorName);
    if (vendorIndex !== -1) {
      setPoItems(intentVendors[vendorIndex].items || []);
      setCurrentVendorIndex(vendorIndex);
    }
  };

  const handleNextVendor = () => {
    if (currentVendorIndex < intentVendors.length - 1) {
      const nextIndex = currentVendorIndex + 1;
      const nextVendor = intentVendors[nextIndex];
      setSelectedVendor(nextVendor.vendorName);
      setPoItems(nextVendor.items || []);
      setCurrentVendorIndex(nextIndex);
    }
  };

  const handlePrevVendor = () => {
    if (currentVendorIndex > 0) {
      const prevIndex = currentVendorIndex - 1;
      const prevVendor = intentVendors[prevIndex];
      setSelectedVendor(prevVendor.vendorName);
      setPoItems(prevVendor.items || []);
      setCurrentVendorIndex(prevIndex);
    }
  };

  const handleQuantityChange = (itemId, quantity) => {
    if (quantity < 1) return;
  
    setPoItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              totalCost: (parseFloat(item.unitCost || 0) * quantity).toFixed(2)
            }
          : item
      )
    );
  };

  const calculateTotals = useMemo(() => {
    const subtotal = poItems.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);
    const taxAmount = (subtotal * (formData.taxRate / 100));
    const totalAmount = subtotal + taxAmount;

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    };
  }, [poItems, formData.taxRate]);

  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO-${year}${month}${day}-${random}`;
  };

  const updateIntentStatus = async (intentId, status) => {
    try {
      await supabase
        .from('intents')
        .update({ status })
        .eq('id', intentId);
    } catch (error) {
      console.error('Error updating intent status:', error);
    }
  };

  const handleSavePO = async (status = 'Draft') => {
    if (!selectedVendor) {
      showNotification('Please select a vendor','error');
      return;
    }

    if (!poItems || poItems.length === 0) {
      showNotification  ('Please add at least one item to the purchase order','error');
      return;
    }
    setIsSaving(true);

    const poNumber = generatePONumber();
    const vendorInfo = getVendorInfo(selectedVendor);

    const itemsData = (poItems || []).map(item => ({
      id: item.id,
      sku: item.sku,
      itemCode: item.itemCode,
      productDescription: item.productDescription,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost
    }));

    const purchaseOrder = {
      po_number: poNumber,
      vendor_name: selectedVendor,
      vendor_id: vendorInfo?.id || '',
      po_date: formData.poDate,
      delivery_date: formData.deliveryDate,
      status,
      items: JSON.stringify(itemsData),
      subtotal: calculateTotals.subtotal,
      tax_rate: formData.taxRate,
      tax_amount: calculateTotals.taxAmount,
      total_amount: calculateTotals.totalAmount,
      notes: formData.notes,
      terms: formData.terms,
      intent_number: selectedIntent?.intent_number || selectedIntent?.intentNumber || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .insert([purchaseOrder]);

      if (error) throw error;

      const successMsg = `Purchase Order ${poNumber} for ${selectedVendor} ${status === 'Draft' ? 'saved as draft' : 'created successfully'}!`;
      showNotification(successMsg, 'success');
      
      if (currentVendorIndex < intentVendors.length - 1) {
        handleNextVendor();
      } else {
        if (selectedIntent && selectedIntent.id) {
          await updateIntentStatus(selectedIntent.id, 'converted_to_po');
        }
        resetForm();
        setActiveTab('history');
      }
      
      await fetchPurchaseOrders();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      showNotification(`Error saving purchase order: ${error.message}. Please try again.`,'error');
    } finally {
      setIsSaving(false);
    }
  };

  
  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const parsedData = (data || []).map(po => {
        let items = [];
        try {
          items = po.items ? JSON.parse(po.items) : [];
        } catch (error) {
          console.error('Error parsing items for PO:', po.po_number, error);
        }
        
        return {
          ...po,
          items: items
        };
      });
      
      setPurchaseOrders(parsedData);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      setPurchaseOrders([]);
    }
  };

  const handleDeletePO = async (poId, poNumber) => {
    showConfirm(
      `Are you sure you want to delete Purchase Order ${poNumber}? This action cannot be undone.`,
      async () => {
        try {
          const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', poId);

          if (error) throw error;

          showNotification('Purchase order deleted successfully!', 'success');
          await fetchPurchaseOrders();
        } catch (error) {
          console.error('Error deleting purchase order:', error);
          showNotification('Error deleting purchase order. Please try again.','error');
        }
      }
    );
  };

  const resetForm = () => {
    setSelectedVendor('');
    setPoItems([]);
    setSearchTerm('');
    setSelectedIntent(null);
    setIntentVendors([]);
    setCurrentVendorIndex(0);
    setFormData({
      poDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      notes: '',
      terms: 'Net 30 days',
      taxRate: 0
    });
  };

  const handleViewPO = (po) => {
    setPoData(po);
    setActiveTab('preview');
  };

  const handlePrintPO = () => {
    if (!poData) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${poData.po_number}</title>
        <style>
          body { 
            font-family: 'Google', sans-serif; 
            margin: 20px;
            color: #333;
            line-height: 1.4;
          }
          .company-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2527258b;
            padding-bottom: 20px;
          }
          .company-header h1 {
            color: #0a3bafca;
            margin: 0;
            font-size: 28px;
          }
          .company-header h2 {
            color: #555;
            margin: 5px 0;
            font-size: 18px;
          }
          .po-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .po-info {
            flex: 1;
          }
          .vendor-info {
            flex: 1;
            text-align: right;
          }
          .po-details {
            margin-bottom: 20px;
          }
          .po-table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12px;
          }
          .po-table th, .po-table td { 
            border: 1px solid #ddd; 
            padding: 10px;
            text-align: left;
          }
          .po-table th { 
            background-color: #184faedc; 
            color: white;
            font-weight: bold;
          }
          .po-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .total-row {
            font-weight: bold;
            background-color: #e9ecef !important;
          }
          .cost-column, .quantity-column {
            text-align: right;
          }
          .totals-section {
            margin-top: 30px;
            text-align: right;
          }
          .totals-table {
            width: 300px;
            margin-left: auto;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 8px;
            border: 1px solid #ddd;
          }
          .totals-table tr:last-child {
            font-weight: bold;
            background-color: #e9ecef;
          }
          .footer {
            margin-top: 50px;
            border-top: 2px solid #3c3e3d96;
            padding-top: 20px;
          }
          .footer-section {
            margin-bottom: 15px;
          }
          .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
          }
          .status-draft { background-color: #6c757d; color: white; }
          .status-sent { background-color: #17a2b8; color: white; }
          .status-confirmed { background-color: #28a745; color: white; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="company-header">
          <h1>KINYA MEDICAL SYSTEM</h1>
          <h2>Purchase Department</h2>
        </div>
        
        <div class="po-header">
          <div class="po-info">
            <h3>PURCHASE ORDER</h3>
            <p><strong>PO Number:</strong> ${poData.po_number}</p>
            <p><strong>PO Date:</strong> ${poData.po_date ? new Date(poData.po_date).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${poData.status?.toLowerCase() || 'draft'}">${poData.status || 'Draft'}</span></p>
          </div>
          <div class="vendor-info">
            <h4>VENDOR</h4>
            <p><strong>${poData.vendor_name}</strong></p>
          </div>
        </div>

        <div class="po-details">
          <p><strong>Delivery Date:</strong> ${poData.delivery_date ? new Date(poData.delivery_date).toLocaleDateString() : 'Not specified'}</p>
          <p><strong>Payment Terms:</strong> ${poData.terms || 'Net 30 days'}</p>
        </div>

        <table class="po-table">
          <thead>
            <tr>
              <th>#</th>
              <th>SKU</th>
              <th>Item Code</th>
              <th>Product Description</th>
              <th>Category</th>
              <th>Unit Cost</th>
              <th>Quantity</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${(poData.items || []).map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${item.sku || 'N/A'}</strong></td>
                <td>${item.itemCode || 'N/A'}</td>
                <td>${item.productDescription || 'N/A'}</td>
                <td>${item.category || 'N/A'}</td>
                <td class="cost-column">₹${(parseFloat(item.unitCost || 0)).toFixed(2)}</td>
                <td class="quantity-column">${item.quantity || 0}</td>
                <td class="cost-column">₹${(parseFloat(item.totalCost || 0)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td>₹${(parseFloat(poData.subtotal || 0)).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax (${poData.tax_rate || 0}%):</td>
              <td>₹${(parseFloat(poData.tax_amount || 0)).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total Amount:</td>
              <td>₹${(parseFloat(poData.total_amount || 0)).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          ${poData.notes ? `
            <div class="footer-section">
              <h4>Notes:</h4>
              <p>${poData.notes}</p>
            </div>
          ` : ''}
          <div class="footer-section">
            <p><strong>Generated on:</strong> ${poData.created_at ? new Date(poData.created_at).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };


  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  return (
    <div className="po-page">
      
      {showConfirmPopup && (
        <div className="po-popup-overlay">
          <div className="po-popup-content confirm-popup">
            <div className="po-popup-icon">
              <i className="fas fa-question-circle"></i>
            </div>
            <p>{popupMessage}</p>
            <div className="po-confirm-actions">
              <button 
                className="po-btn po-btn-danger" 
                onClick={() => {
                  popupAction();
                  setShowConfirmPopup(false);
                }}
              >
                Delete
              </button>
              <button 
                className="po-btn po-btn-secondary" 
                onClick={() => setShowConfirmPopup(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="po-header">
        <div className="po-title-section">
          <h2><i className="fas fa-file-invoice"></i>Purchase Orders</h2>
          <p>Create and manage vendor-based purchase orders</p>
        </div>
      </div>

      <div className="po-stats">
        <div className="po-stat-card">
          <div className="po-stat-icon green">
            <i className="fas fa-file-invoice"></i>
          </div>
          <div className="po-stat-info">
            <h3>{purchaseOrders.length}</h3>
            <p>Total POs</p>
          </div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon blue">
            <i className="fas fa-truck"></i>
          </div>
          <div className="po-stat-info">
            <h3>{approvedVendors.length}</h3>
            <p>Approved Vendors</p>
          </div>
        </div>
      </div>

      <div className="po-tabs">
        <button 
          className={`po-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <i className="fas fa-plus-circle"></i>
           Create New PO
        </button>
        <button 
          className={`po-tab ${activeTab === 'intents' ? 'active' : ''}`}
          onClick={() => setActiveTab('intents')}
        >
          <i className="fas fa-file-invoice"></i>
          Load from Intents ({availableIntents.length})
        </button>
        <button 
          className={`po-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <i className="fas fa-history"></i>
          PO History ({purchaseOrders.length})
        </button>
        {activeTab === 'preview' && (
          <button className="po-tab active">
            <i className="fas fa-eye"></i>
            PO Preview
          </button>
        )}
      </div>

      {activeTab === 'create' && (
        <div className="po-creation-card">
          <div className='po-card-header'><h3><i className="fas fa-file-purchase-order"></i>Create New Purchase Order</h3> 
           <button className='po-btn danger' onClick={resetForm}><i className="fa-solid fa-circle-xmark"></i> Cancel</button></div>
          
          {selectedIntent && (
            <div className="po-intent-reference">
              <div className="po-alert-info">
                <span><i className="fas fa-info-circle"></i>
                Creating PO from Intent : <strong> ( {selectedIntent.intent_number || selectedIntent.intentNumber} )</strong></span>
                <div className="po-vendor-navigation">
                  <span>Vendor {currentVendorIndex + 1} of {intentVendors.length}</span>
                  {intentVendors.length > 1 && (
                    <div className="po-nav-buttons">
                      <button 
                        className="po-nav-btn"
                        onClick={handlePrevVendor}
                        disabled={currentVendorIndex === 0}
                      >
                        <i className="fas fa-chevron-left"></i> Previous
                      </button>
                      <button 
                        className="po-nav-btn"
                        onClick={handleNextVendor}
                        disabled={currentVendorIndex === intentVendors.length - 1}
                      >
                        Next <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="po-form-section">
            <div className="po-form-grid">
              <div className="po-form-group">
                <label><i className="fas fa-truck"></i>Select Vendor *</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => selectedIntent ? handleVendorChange(e.target.value) : setSelectedVendor(e.target.value)}
                  className="po-form-input"
                  disabled={selectedIntent}
                >
                  <option value="">Choose Vendor</option>
                  {selectedIntent ? (
                    intentVendors.map(vendor => (
                      <option key={vendor.vendorName} value={vendor.vendorName}>
                        {vendor.vendorName} ({vendor.items?.length || 0} items)
                      </option>
                    ))
                  ) : (
                    approvedVendors.map(vendor => (
                      <option key={vendor.id} value={vendor.vendor_name}>
                        {vendor.vendor_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="po-form-group">
                <label><i className="fas fa-calendar"></i>PO Date</label>
                <input
                  type="date"
                  value={formData.poDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, poDate: e.target.value }))}
                  className="po-form-input"
                />
              </div>

              <div className="po-form-group">
                <label><i className="fas fa-shipping-fast"></i>Delivery Date</label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="po-form-input"
                />
              </div>

              <div className="po-form-group">
                <label><i className="fas fa-percentage"></i>Tax Rate (%)</label>
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                  step="0.1"
                  min="0"
                  max="100"
                  className="po-form-input"
                />
              </div>

              <div className="po-form-group full-width">
                <label><i className="fas fa-sticky-note"></i>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes for the purchase order..."
                  rows="2"
                  className="po-form-input"
                />
              </div>

              <div className="po-form-group full-width">
                <label><i className="fas fa-file-contract"></i>Payment Terms</label>
                <select
                  value={formData.terms}
                  onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                  className="po-form-input"
                >
                  <option value="Net 15 days">Net 15 days</option>
                  <option value="Net 30 days">Net 30 days</option>
                  <option value="Net 45 days">Net 45 days</option>
                  <option value="Net 60 days">Net 60 days</option>
                  <option value="Due on receipt">Due on receipt</option>
                </select>
              </div>
            </div>
          </div>

          {poItems && poItems.length > 0 && (
            <div className="po-items-section">
              <div className="po-section-header">
                <h4>
                  <i className="fas fa-shopping-cart"></i>
                  PO Items for {selectedVendor} ({poItems.length} items)
                  {selectedIntent && intentVendors[currentVendorIndex] && (
                    <span className="po-vendor-stats">
                      | Total: ₹{(intentVendors[currentVendorIndex]?.totalCost || 0).toFixed(2)} | Qty: {intentVendors[currentVendorIndex]?.totalQuantity || 0}
                    </span>
                  )}
                </h4>
              </div>

              <div className="po-items-table">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Unit Cost</th>
                      <th>Quantity</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.sku}</strong></td>
                        <td>{item.itemCode}</td>
                        <td>{item.productDescription}</td>
                        <td>{item.category}</td>
                        <td>₹{(parseFloat(item.unitCost || 0)).toFixed(2)}</td>
                        <td>
                          <div className="po-quantity-control">
                            <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>
                              <i className="fas fa-minus"></i>
                            </button>
                            <span>{item.quantity}</span>
                            <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>
                              <i className="fas fa-plus"></i>
                            </button>
                          </div>
                        </td>
                        <td>₹{(parseFloat(item.totalCost || 0)).toFixed(2)}</td>
                        <td>
                          {!selectedIntent && (
                            <button 
                              className="po-btn-icon delete"
                              onClick={() => setPoItems(prev => prev.filter(i => i.id !== item.id))}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="po-totals-section">
                <div className="po-totals-card">
                  <div className="po-total-row">
                    <span>Subtotal:</span>
                    <span>₹{calculateTotals.subtotal}</span>
                  </div>
                  <div className="po-total-row">
                    <span>Tax ({formData.taxRate}%):</span>
                    <span>₹{calculateTotals.taxAmount}</span>
                  </div>
                  <div className="po-total-row grand-total">
                    <span>Total Amount:</span>
                    <span>₹{calculateTotals.totalAmount}</span>
                  </div>
                </div>
              </div>

              <div className="po-actions">
                <button 
                  className="po-save-draft-btn"
                  onClick={() => handleSavePO('Draft')}
                  disabled={isSaving}
                >
                  <i className="fas fa-save"></i>
                  {isSaving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button 
                  className="po-create-btn"
                  onClick={() => handleSavePO('Sent')}
                  disabled={isSaving}
                >
                  <i className="fas fa-paper-plane"></i>
                  {isSaving ? 'Saving...' : selectedIntent && currentVendorIndex < intentVendors.length - 1 ? 'Save & Next Vendor' : 'Create & Send PO'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'intents' && (
        <div className="po-intents-selection">
          <div className="po-section-header">
            <h3><i className="fas fa-file-invoice"></i>Select Purchase Intent</h3>
            <p>Choose a saved purchase intent to convert to purchase orders (grouped by vendor)</p>
          </div>

          <div className="po-table-container">
            <table className="po-data-table">
              <thead>
                <tr>
                  <th>Intent Number</th>
                  <th>Generated Date</th>
                  <th>Total Items</th>
                  <th>Vendors</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {availableIntents.length > 0 ? (
                  availableIntents.map(intent => {
                    const vendors = groupIntentItemsByVendor(intent.items || []);
                    return (
                      <tr key={intent.id}>
                        <td><strong>{intent.intent_number}</strong></td>
                        <td>{intent.generated_at ? new Date(intent.generated_at).toLocaleDateString() : 'N/A'}</td>
                        <td>{intent.total_items}</td>
                        <td>
                          <div className="po-vendor-tags">
                            {vendors.map(vendor => (
                              <span key={vendor.vendorName} className="po-vendor-tag">
                                {vendor.vendorName} ({vendor.items?.length || 0})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>₹{(parseFloat(intent.total_cost || 0)).toFixed(2)}</td>
                        <td>
                          <span className={`po-status-badge status-${intent.status || 'draft'}`}>
                            {intent.status || 'Draft'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="po-btn po-btn-primary po-btn-sm"
                            onClick={() => handleIntentSelect(intent)}
                            disabled={intent.status === 'converted_to_po'}
                          >
                            {intent.status === 'converted_to_po' ? 'Already Converted' : 'Create POs by Vendor'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="po-empty-table-message">
                      <div className="po-empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>No Purchase Intents</h3>
                        <p>Create purchase intents first to load them here</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="po-history">
          <div className="po-history-header">
            <h3><i className="fas fa-history"></i>Purchase Order History</h3>
            <div className="po-history-controls">
              <div className="po-search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search POs by number or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="po-search-input"
                />
              </div>
            </div>
          </div>

          <div className="po-table-container">
            <table className="po-data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>PO Date</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Total Amount</th>
                  <th>Intent Number</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length > 0 ? (
                  purchaseOrders
                    .filter(po => 
                      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      po.intent_number?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(po => (
                    <tr key={po.id}>
                      <td><strong>{po.po_number}</strong></td>
                      <td>{po.vendor_name}</td>
                      <td>{po.po_date ? new Date(po.po_date).toLocaleDateString() : 'N/A'}</td>
                      <td>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <span className={`po-status-badge status-${po.status?.toLowerCase() || 'draft'}`}>
                          {po.status || 'Draft'}
                        </span>
                      </td>
                      <td>₹{(parseFloat(po.total_amount || 0)).toFixed(2)}</td>
                      <td>{po.intent_number || '-'}</td>
                      <td>{po.created_at ? new Date(po.created_at).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <div className="po-action-buttons">
                          <button 
                            className="po-btn-icon view"
                            onClick={() => handleViewPO(po)}
                            title="View PO"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="po-btn-icon delete"
                            onClick={() => handleDeletePO(po.id, po.po_number)}
                            title="Delete PO"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="po-empty-table-message">
                      <div className="po-empty-state">
                        <i className="fas fa-file-invoice"></i>
                        <h3>No Purchase Orders</h3>
                        <p>Create your first purchase order to get started</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'preview' && poData && (
        <div className="po-preview">
          <div className="po-preview-header">
            <h3><i className="fas fa-file-invoice"></i>Purchase Order Preview</h3>
            <div className="po-preview-actions">
              <button className="po-print-btn" onClick={handlePrintPO}>
                <i className="fas fa-print"></i>
                Print PO
              </button>
              <button className="po-download-btn">
                <i className="fas fa-download"></i>
                Download PO
              </button>
              <button className="po-back-btn" onClick={() => setActiveTab('history')}>
                <i className="fas fa-arrow-left"></i>
                Back to History
              </button>
            </div>
          </div>

          <div className="po-preview-content">
            <div className="po-company-header">
              <h1>KINYA MEDICAL SYSTEM</h1>
              <h2>Purchase Department</h2>
            </div>
            
            <div className="po-preview-header-info">
              <div className="po-preview-info">
                <h3>PURCHASE ORDER</h3>
                <p><strong>PO Number:</strong> {poData.po_number}</p>
                <p><strong>PO Date:</strong> {poData.po_date ? new Date(poData.po_date).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Status:</strong> <span className={`po-status-badge status-${poData.status?.toLowerCase() || 'draft'}`}>{poData.status || 'Draft'}</span></p>
                {poData.intent_number && (
                  <p><strong>Intent Number:</strong> {poData.intent_number}</p>
                )}
              </div>
              <div className="po-preview-vendor">
                <h4>VENDOR</h4>
                <p><strong>{poData.vendor_name}</strong></p>
              </div>
            </div>

            <div className="po-preview-details">
              <p><strong>Delivery Date:</strong> {poData.delivery_date ? new Date(poData.delivery_date).toLocaleDateString() : 'Not specified'}</p>
              <p><strong>Payment Terms:</strong> {poData.terms || 'Net 30 days'}</p>
            </div>

            <table className="po-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SKU</th>
                  <th>Item Code</th>
                  <th>Product Description</th>
                  <th>Category</th>
                  <th>Unit Cost</th>
                  <th>Quantity</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {(poData.items || []).length > 0 ? (
                  (poData.items || []).map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>
                      <td><strong>{item.sku || 'N/A'}</strong></td>
                      <td>{item.itemCode || 'N/A'}</td>
                      <td>{item.productDescription || 'N/A'}</td>
                      <td>{item.category || 'N/A'}</td>
                      <td className="po-cost-column">₹{(parseFloat(item.unitCost || 0)).toFixed(2)}</td>
                      <td className="po-quantity-column">{item.quantity || 0}</td>
                      <td className="po-cost-column">₹{(parseFloat(item.totalCost || 0)).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="po-empty-table-message">No items found</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="po-preview-totals">
              <div className="po-preview-totals-card">
                <div className="po-preview-total-row">
                  <span>Subtotal:</span>
                  <span>₹{(parseFloat(poData.subtotal || 0)).toFixed(2)}</span>
                </div>
                <div className="po-preview-total-row">
                  <span>Tax ({poData.tax_rate || 0}%):</span>
                  <span>₹{(parseFloat(poData.tax_amount || 0)).toFixed(2)}</span>
                </div>
                <div className="po-preview-total-row grand-total">
                  <span>Total Amount:</span>
                  <span>₹{(parseFloat(poData.total_amount || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {poData.notes && (
              <div className="po-preview-notes">
                <h4>Notes:</h4>
                <p>{poData.notes}</p>
              </div>
            )}

            <div className="po-preview-footer">
              <p><strong>Generated on:</strong> {poData.created_at ? new Date(poData.created_at).toLocaleString() : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderPage;