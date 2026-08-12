import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import "./BOMPage.css"

const BOMPage = ({ boms, setBoms, items, setItems, fetchBOMs, fetchItems, onGenerateIntent, vendors, showNotification }) => {
  const [bomName, setBomName] = useState('');
  const [expandedBomId, setExpandedBomId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBom, setEditingBom] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    show: false,
    sku: '',
    item_code: '',
    product_description: '',
    category: '',
    order_link: '',
    vendors: [{ name: '', cost: '', primary: true }]
  });
  const [bomItemSearch, setBomItemSearch] = useState('');
  const [bomItemsSearch, setBomItemsSearch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '', onConfirm: null });
  const [editingQuantity, setEditingQuantity] = useState({ bomId: null, itemId: null, value: '' });
  const [localBoms, setLocalBoms] = useState([]);

  // Update local boms when props change
  useEffect(() => {
    setLocalBoms(boms);
  }, [boms]);

  const existingCategories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const approvedVendors = vendors.filter(vendor => vendor.status === 'Approved');

  const showPopup = (type, message, onConfirm = null) => {
    setPopup({ show: true, type, message, onConfirm });
  };

  const hidePopup = () => {
    setPopup({ show: false, type: '', message: '', onConfirm: null });
  };

  const formatRupees = (amount) => {
    if (!amount) return '₹0';
    const num = parseFloat(amount);
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Toggle expand/collapse for a BOM
  const toggleBomExpand = (bomId) => {
    setExpandedBomId(prevId => prevId === bomId ? null : bomId);
  };

  const handleCreateBOM = async () => {
    if (isSaving) return;
    
    if (!bomName.trim()) {
      showPopup('error', 'Please enter BOM name');
      return;
    }

    setIsSaving(true);

    const newBOM = {
      bom_name: bomName.trim(),
      items: JSON.stringify([]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('boms')
        .insert([newBOM]);

      if (error) throw error;

      await fetchBOMs();
      setBomName('');
      showPopup('success', 'BOM created successfully!');
    } catch (error) {
      console.error('Error creating BOM:', error);
      showPopup('error', 'Error creating BOM. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryChange = (value) => {
    if (value === 'new') {
      setShowNewCategory(true);
      setNewItemForm(prev => ({ ...prev, category: '' }));
    } else {
      setShowNewCategory(false);
      setNewItemForm(prev => ({ ...prev, category: value }));
    }
  };

  const handleVendorSelection = (index, vendorName) => {
    const selectedVendor = vendors.find(v => v.vendor_name === vendorName);
    if (selectedVendor) {
      const updatedVendors = newItemForm.vendors.map((vendor, i) =>
        i === index ? { ...vendor, name: vendorName } : vendor
      );
      setNewItemForm(prev => ({ ...prev, vendors: updatedVendors }));
    }
  };

  const handleCreateItemInBOM = async () => {
    if (!newItemForm.sku || !newItemForm.item_code) {
      showPopup('error', 'SKU and Item Code are required');
      return;
    }

    // Check for duplicate SKU
    const { data: existingItem } = await supabase
      .from('items')
      .select('id')
      .eq('sku', newItemForm.sku)
      .single();

    if (existingItem) {
      showPopup('error', 'SKU must be unique');
      return;
    }

    setIsSaving(true);

    const vendorsJSON = JSON.stringify(newItemForm.vendors);
    const finalCategory = showNewCategory && newCategory ? newCategory : newItemForm.category;

    const itemData = {
      sku: newItemForm.sku,
      item_code: newItemForm.item_code,
      product_description: newItemForm.product_description,
      category: finalCategory,
      order_link: newItemForm.order_link,
      vendors: vendorsJSON,
      bom_id: expandedBomId,
      bom_name: localBoms.find(b => b.id === expandedBomId)?.bom_name || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Create new item
      const { error: itemError } = await supabase
        .from('items')
        .insert([itemData]);

      if (itemError) throw itemError;

      // Get the newly created item to get its ID
      const { data: newItem } = await supabase
        .from('items')
        .select('*')
        .eq('sku', newItemForm.sku)
        .single();

      // Add item to BOM
      const vendors = newItemForm.vendors;
      const primaryVendor = vendors.find(v => v.primary) || vendors[0];
      
      const bomItem = {
        id: newItem.id,
        sku: newItem.sku,
        item_code: newItem.item_code,
        product_description: newItem.product_description,
        category: newItem.category,
        order_link: newItem.order_link,
        vendor: primaryVendor ? primaryVendor.name : '',
        cost: primaryVendor ? primaryVendor.cost : '',
        quantity: 1
      };

      const currentBom = localBoms.find(b => b.id === expandedBomId);
      const currentItems = currentBom.items || [];
      const updatedItems = [...currentItems, bomItem];

      // Update BOM in database
      const { error: bomError } = await supabase
        .from('boms')
        .update({
          items: JSON.stringify(updatedItems),
          updated_at: new Date().toISOString()
        })
        .eq('id', expandedBomId);

      if (bomError) throw bomError;

      await fetchItems();
      await fetchBOMs();
      
      setNewItemForm({
        show: false,
        sku: '',
        item_code: '',
        product_description: '',
        category: '',
        order_link: '',
        vendors: [{ name: '', cost: '', primary: true }]
      });
      setShowNewCategory(false);
      setNewCategory('');
      showPopup('success', 'Item created and added to BOM successfully!');
    } catch (error) {
      console.error('Error creating item in BOM:', error);
      showPopup('error', 'Error creating item in BOM. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddVendor = () => {
    setNewItemForm(prev => ({
      ...prev,
      vendors: [...prev.vendors, { name: '', cost: '', primary: false }]
    }));
  };

  const handleVendorChange = (index, field, value) => {
    const updatedVendors = newItemForm.vendors.map((vendor, i) =>
      i === index ? { ...vendor, [field]: value } : vendor
    );
    setNewItemForm(prev => ({ ...prev, vendors: updatedVendors }));
  };

  const setPrimaryVendor = (index) => {
    const updatedVendors = newItemForm.vendors.map((vendor, i) => ({
      ...vendor,
      primary: i === index
    }));
    setNewItemForm(prev => ({ ...prev, vendors: updatedVendors }));
  };

  const removeVendor = (index) => {
    if (newItemForm.vendors.length <= 1) return;
    const updatedVendors = newItemForm.vendors.filter((_, i) => i !== index);
    if (updatedVendors.length > 0 && !updatedVendors.some(v => v.primary)) {
      updatedVendors[0].primary = true;
    }
    setNewItemForm(prev => ({ ...prev, vendors: updatedVendors }));
  };

  const handleAddItemToBOM = async (bomId, item) => {
    const bom = localBoms.find(b => b.id === bomId);
    const existingItem = bom.items.find(i => i.id === item.id);
    if (existingItem) {
      showPopup('error', 'Item already exists in this BOM');
      return;
    }
    
    let vendors = [];
    try {
      vendors = item.vendors ? JSON.parse(item.vendors) : [];
    } catch (error) {
      console.error('Error parsing vendors:', error);
    }
    const primaryVendor = vendors.find(v => v.primary) || vendors[0];
    
    const bomItem = {
      id: item.id,
      sku: item.sku,
      item_code: item.item_code,
      product_description: item.product_description,
      category: item.category,
      order_link: item.order_link,
      vendor: primaryVendor ? primaryVendor.name : '',
      cost: primaryVendor ? primaryVendor.cost : '',
      quantity: 1
    };

    const updatedItems = [...bom.items, bomItem];

    try {
      // Update BOM in database
      const { error: bomError } = await supabase
        .from('boms')
        .update({
          items: JSON.stringify(updatedItems),
          updated_at: new Date().toISOString()
        })
        .eq('id', bomId);

      if (bomError) throw bomError;

      // Update item with BOM information
      const { error: itemError } = await supabase
        .from('items')
        .update({
          bom_id: bomId,
          bom_name: bom.bom_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (itemError) throw itemError;

      await fetchBOMs();
      await fetchItems();
      showPopup('success', 'Item added to BOM successfully!');
    } catch (error) {
      console.error('Error adding item to BOM:', error);
      showPopup('error', 'Error adding item to BOM. Please check your connection and try again.');
    }
  };

  const startEditingQuantity = (bomId, itemId, currentQuantity) => {
    setEditingQuantity({ bomId, itemId, value: currentQuantity.toString() });
  };

  const cancelEditingQuantity = () => {
    setEditingQuantity({ bomId: null, itemId: null, value: '' });
  };

  const saveQuantity = async () => {
    const { bomId, itemId, value } = editingQuantity;
    const quantity = parseInt(value) || 1;
    
    if (quantity < 1) {
      showPopup('error', 'Quantity must be at least 1');
      return;
    }

    await handleUpdateQuantity(bomId, itemId, quantity);
    setEditingQuantity({ bomId: null, itemId: null, value: '' });
  };

  const handleUpdateQuantity = async (bomId, itemId, quantity) => {
    const bom = localBoms.find(b => b.id === bomId);
    const updatedItems = bom.items.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
    );

    try {
      const { error } = await supabase
        .from('boms')
        .update({
          items: JSON.stringify(updatedItems),
          updated_at: new Date().toISOString()
        })
        .eq('id', bomId);

      if (error) throw error;
      
      await fetchBOMs();
      showPopup('success', 'Quantity updated successfully!');
    } catch (error) {
      console.error('Error updating quantity:', error);
      showPopup('error', 'Error updating quantity. Please check your connection and try again.');
    }
  };

  const handleRemoveItemFromBOM = async (bomId, itemId) => {
    const bom = localBoms.find(b => b.id === bomId);
    const updatedItems = bom.items.filter(item => item.id !== itemId);

    try {
      // Update BOM in database
      const { error: bomError } = await supabase
        .from('boms')
        .update({
          items: JSON.stringify(updatedItems),
          updated_at: new Date().toISOString()
        })
        .eq('id', bomId);

      if (bomError) throw bomError;

      // Update item to remove BOM association
      const { error: itemError } = await supabase
        .from('items')
        .update({
          bom_id: null,
          bom_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      await fetchBOMs();
      await fetchItems();
      showPopup('success', 'Item removed from BOM successfully!');
    } catch (error) {
      console.error('Error removing item from BOM:', error);
      showPopup('error', 'Error removing item from BOM. Please check your connection and try again.');
    }
  };

  const handleSaveBOM = async (bom) => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('boms')
        .update({
          bom_name: bom.bom_name,
          items: JSON.stringify(bom.items),
          updated_at: new Date().toISOString()
        })
        .eq('id', bom.id);

      if (error) throw error;

      setEditingBom(null);
      await fetchBOMs();
      showPopup('success', 'BOM saved successfully!');
    } catch (error) {
      console.error('Error saving BOM:', error);
      showPopup('error', 'Error saving BOM. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBOM = async (bomId) => {
    showPopup('confirm', 
      'Are you sure you want to delete this BOM? This will also remove BOM associations from all items.',
      async () => {
        try {
          // First, remove BOM associations from all items
          const { error: itemsError } = await supabase
            .from('items')
            .update({
              bom_id: null,
              bom_name: null,
              updated_at: new Date().toISOString()
            })
            .eq('bom_id', bomId);

          if (itemsError) throw itemsError;

          // Then delete the BOM
          const { error: bomError } = await supabase
            .from('boms')
            .delete()
            .eq('id', bomId);

          if (bomError) throw bomError;

          await fetchBOMs();
          await fetchItems();
          if (expandedBomId === bomId) {
            setExpandedBomId(null);
          }
          showPopup('success', 'BOM deleted successfully!');
        } catch (error) {
          console.error('Error deleting BOM:', error);
          showPopup('error', 'Error deleting BOM. Please check your connection and try again.');
        }
      }
    );
  };

  const handleEditBOMName = async (bom, newName) => {
    if (!newName.trim()) {
      showPopup('error', 'BOM name cannot be empty');
      return;
    }

    try {
      // Update BOM name
      const { error: bomError } = await supabase
        .from('boms')
        .update({
          bom_name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bom.id);

      if (bomError) throw bomError;

      // Also update BOM name in all associated items
      const { error: itemsError } = await supabase
        .from('items')
        .update({
          bom_name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('bom_id', bom.id);

      if (itemsError) throw itemsError;

      await fetchBOMs();
      await fetchItems();
      setEditingBom(null);
      showPopup('success', 'BOM name updated successfully!');
    } catch (error) {
      console.error('Error updating BOM name:', error);
      showPopup('error', 'Error updating BOM name. Please check your connection and try again.');
    }
  };

  const handleDeleteBOMItem = async (bomId, itemId) => {
    showPopup('confirm', 
      'Are you sure you want to remove this item from the BOM?',
      () => handleRemoveItemFromBOM(bomId, itemId)
    );
  };

  const filteredBoms = localBoms.filter(bom =>
    bom.bom_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableItems = items
    .filter(item => !expandedBomId || !localBoms.find(b => b.id === expandedBomId)?.items.some(bomItem => bomItem.id === item.id))
    .filter(item => 
      item.sku?.toLowerCase().includes(bomItemSearch.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(bomItemSearch.toLowerCase()) ||
      item.product_description?.toLowerCase().includes(bomItemSearch.toLowerCase())
    );

  const getBomItems = (bom) => {
    return bom.items || [];
  };

  const filteredBomItems = (bom) => {
    const items = getBomItems(bom);
    return items.filter(item =>
      item.sku?.toLowerCase().includes(bomItemsSearch.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(bomItemsSearch.toLowerCase()) ||
      item.product_description?.toLowerCase().includes(bomItemsSearch.toLowerCase())
    );
  };

  return (
    <div className="bom-page">
      {/* Popup Component */}
      {popup.show && (
        <div className="bom-popup-overlay">
          <div className="bom-popup">
            <div className={`bom-popup-icon ${popup.type}`}>
              {popup.type === 'success' && <i className="fas fa-check-circle"></i>}
              {popup.type === 'error' && <i className="fas fa-exclamation-circle"></i>}
              {popup.type === 'confirm' && <i className="fas fa-question-circle"></i>}
            </div>
            <div className="bom-popup-content">
              <h3>{popup.type === 'success' ? 'Success' : popup.type === 'error' ? 'Error' : 'Confirm'}</h3>
              <p>{popup.message}</p>
            </div>
            <div className="bom-popup-actions">
              {popup.type === 'confirm' ? (
                <>
                  <button className="bom-btn bom-btn-outline" onClick={hidePopup}>
                    Cancel
                  </button>
                  <button className="bom-btn bom-btn-danger" onClick={() => { popup.onConfirm(); hidePopup(); }}>
                    Confirm
                  </button>
                </>
              ) : (
                <button className="bom-btn bom-btn-primary" onClick={hidePopup}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bom-header">
        <div className="bom-title-section">
          <h2><i className="fas fa-sitemap"></i>BOM Management</h2>
          <p>Create and manage groups of items as BOMs</p>
        </div>
        <div className="bom-header-actions">
          <button className="bom-generate-btn" onClick={onGenerateIntent}>
            <i className="fas fa-file-invoice-dollar"></i>
            Generate Purchase Intent
          </button>
        </div>
      </div>

      <div className="bom-stats">
        <div className="bom-stat-card">
          <div className="bom-stat-icon purple">
            <i className="fas fa-sitemap"></i>
          </div>
          <div className="bom-stat-info">
            <h3>{localBoms.length}</h3>
            <p>Total BOMs</p>
          </div>
        </div>
        <div className="bom-stat-card">
          <div className="bom-stat-icon indigo">
            <i className="fas fa-cubes"></i>
          </div>
          <div className="bom-stat-info">
            <h3>
              {localBoms.reduce((total, bom) => total + (bom.items?.length || 0), 0)}
            </h3>
            <p>Items in BOMs</p>
          </div>
        </div>
      </div>

      <div className="bom-creation-card">
        <h3><i className="fas fa-plus-circle"></i>Create New BOM</h3>
        <div className="bom-create-form">
          <input
            type="text"
            placeholder="Enter New BOM Name"
            value={bomName}
            onChange={(e) => setBomName(e.target.value)}
            className="bom-form-input"
          />
          <button 
            className={`bom-create-btn ${isSaving ? 'loading' : ''}`} 
            onClick={handleCreateBOM}
            disabled={isSaving}
          >
            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
            {isSaving ? 'Creating...' : 'Create New BOM'}
          </button>
        </div>
      </div>

      <div className="bom-search-section">
        <div className="bom-search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search BOMs by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bom-search-input"
          />
        </div>
      </div>

      <div className="boms-grid">
        {filteredBoms.length > 0 ? (
          filteredBoms.map(bom => {
            const isExpanded = expandedBomId === bom.id;
            return (
              <div key={bom.id} className="bom-card">
                <div className="bom-card-header">
                  <div className="bom-title-info">
                    {editingBom === bom.id ? (
                      <input
                        type="text"
                        value={bom.bom_name}
                        onChange={(e) => {
                          const updatedBom = { ...bom, bom_name: e.target.value };
                          setLocalBoms(prev => prev.map(b => b.id === bom.id ? updatedBom : b));
                        }}
                        onBlur={() => handleEditBOMName(bom, bom.bom_name)}
                        onKeyPress={(e) => e.key === 'Enter' && handleEditBOMName(bom, bom.bom_name)}
                        autoFocus
                        className="bom-form-input"
                      />
                    ) : (
                      <h3 onDoubleClick={() => setEditingBom(bom.id)}>
                        <i className="fas fa-project-diagram"></i>
                        {bom.bom_name}
                        <span className="bom-item-count">({bom.items?.length || 0} items)</span>
                      </h3>
                    )}
                    <div className="bom-meta">
                      <span><i className="fas fa-calendar"></i> {new Date(bom.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="bom-card-actions">
                    <button 
                      className="bom-expand-btn" 
                      onClick={() => toggleBomExpand(bom.id)}
                      title={isExpanded ? 'Collapse BOM' : 'Expand BOM'}
                    >
                      <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    <button 
                      className={`bom-save-btn ${isSaving ? 'loading' : ''}`} 
                      onClick={() => handleSaveBOM(bom)}
                      disabled={isSaving}
                      title="Save BOM"
                    >
                      <i className="fas fa-save"></i>
                    </button>
                    <button 
                      className="bom-delete-btn" 
                      onClick={() => handleDeleteBOM(bom.id)}
                      title="Delete BOM"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bom-content">
                    {/* Create New Item Form */}
                    <div className="bom-create-item-section">
                      <div className="bom-section-header">
                        <h4><i className="fas fa-plus-circle"></i>Create New Item in this BOM</h4>
                        <button 
                          type="button" 
                          className="bom-toggle-form-btn"
                          onClick={() => setNewItemForm(prev => ({ ...prev, show: !prev.show }))}
                        >
                            {newItemForm.show? <i className="fas fa-circle-xmark"></i>:<i className="fas fa-plus"></i>}
                          {newItemForm.show ? 'Cancel' : 'Create New Item'}
                        </button>
                      </div>
                      
                      {newItemForm.show && (
                        <div className="bom-item-form">
                          <div className="bom-form-grid">
                            <div className="bom-form-group">
                              <label><i className="fas fa-barcode"></i>SKU *</label>
                              <input
                                type="text"
                                value={newItemForm.sku}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, sku: e.target.value }))}
                                placeholder="Enter unique SKU"
                                className="bom-form-input"
                              />
                            </div>

                            <div className="bom-form-group">
                              <label><i className="fas fa-tag"></i>Item Code *</label>
                              <input
                                type="text"
                                value={newItemForm.item_code}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, item_code: e.target.value }))}
                                placeholder="Enter item code"
                                className="bom-form-input"
                              />
                            </div>
                            <div className="bom-form-group full-width">
                              <label><i className="fas fa-align-left"></i>Product Description</label>
                              <textarea
                                value={newItemForm.product_description}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, product_description: e.target.value }))}
                                placeholder="Enter product description"
                                rows="2"
                                className="bom-form-input"
                              />
                            </div>
                            <div className="bom-form-group">
                              <label><i className="fas fa-folder"></i>Category</label>
                              <div className="bom-category-selector">
                                <select
                                  value={showNewCategory ? 'new' : newItemForm.category}
                                  onChange={(e) => handleCategoryChange(e.target.value)}
                                  className="bom-form-input"
                                 >
                                  <option value="">Select Category</option>
                                  {existingCategories.map(category => (
                                    <option key={category} value={category}>
                                      {category}
                                    </option>
                                  ))}
                                  <option value="new">+ Add New Category</option>
                                </select>
                                {showNewCategory && (
                                  <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    placeholder="Enter new category name"
                                    className="bom-form-input bom-new-category-input"
                                    />
                                )}
                              </div>
                            </div>

                            <div className="bom-form-group full-width">
                              <label><i className="fas fa-link"></i>Order Link</label>
                              <textarea
                                value={newItemForm.order_link}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, order_link: e.target.value }))}
                                placeholder="Enter order link"
                                rows="2"
                                className="bom-form-input"
                              />
                            </div>
                          </div>

                          <div className="bom-vendors-section">
                            <div className="bom-section-header">
                              <label><i className="fas fa-truck"></i>Vendors Information</label>
                              <button type="button" className="bom-add-vendor-btn" onClick={handleAddVendor}>
                                <i className="fas fa-plus"></i>
                                Add Vendor
                              </button>
                            </div>
                            
                            {newItemForm.vendors.map((vendor, index) => (
                              <div key={index} className="bom-vendor-card">
                                <div className="bom-vendor-inputs">
                                  <div className="bom-vendor-dropdown-container">
                                    <select
                                      value={vendor.name}
                                      onChange={(e) => handleVendorSelection(index, e.target.value)}
                                      className="bom-form-input bom-vendor-dropdown"
                                    >
                                      <option value="">Select Vendor</option>
                                      {approvedVendors.map(vendor => (
                                        <option key={vendor.id} value={vendor.vendor_name}>
                                          {vendor.vendor_name}
                                        </option>
                                      ))}
                                    </select>
                                    {!vendor.name && (
                                      <div className="bom-vendor-hint">
                                        <small>Or enter vendor name manually below</small>
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Vendor Company Name"
                                    value={vendor.name}
                                    onChange={(e) => handleVendorChange(index, 'name', e.target.value)}
                                    className="bom-form-input"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Item Cost"
                                    value={vendor.cost}
                                    onChange={(e) => handleVendorChange(index, 'cost', e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className="bom-form-input"
                                  />
                                </div>
                                <div className="bom-vendor-actions">
                                  <button
                                    type="button"
                                    className={`bom-primary-btn ${vendor.primary ? 'active' : ''}`}
                                    onClick={() => setPrimaryVendor(index)}
                                    disabled={vendor.primary}
                                  >
                                    <i className={`fas ${vendor.primary ? 'fa-star' : 'fa-star'}`}></i>
                                    {vendor.primary ? 'Primary Vendor' : 'Set as Primary'}
                                  </button>
                                  {newItemForm.vendors.length > 1 && (
                                    <button
                                      type="button"
                                      className="bom-danger-btn"
                                      onClick={() => removeVendor(index)}
                                      disabled={vendor.primary}
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="bom-form-actions">
                            <button 
                              className={`bom-save-btn ${isSaving ? 'loading' : ''}`}
                              onClick={handleCreateItemInBOM}
                              disabled={isSaving}
                            >
                              <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                              {isSaving ? 'Creating...' : 'Create Item & Add to BOM'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bom-available-items">
                      <div className="bom-section-header"> 
                        <h4><i className="fas fa-search"></i>Add Existing Items to BOM</h4>
                        <div className="bom-search-box small">
                          <i className="fas fa-search"></i>
                          <input
                            type="text"
                            placeholder="Search available items..."
                            value={bomItemSearch}
                            onChange={(e) => setBomItemSearch(e.target.value)}
                            className="bom-search-input"
                          />
                        </div>
                      </div>
                      <div className="bom-items-grid">
                        {availableItems.length > 0 ? (
                          availableItems.map(item => {
                            let vendors = [];
                            try {
                              vendors = item.vendors ? JSON.parse(item.vendors) : [];
                            } catch (error) {
                              console.error('Error parsing vendors:', error);
                            }
                            const primaryVendor = vendors.find(v => v.primary) || vendors[0];
                            
                            return (
                              <div key={item.id} className="bom-item-card">
                                <div className="bom-item-info">
                                  <div className="bom-item-header">
                                    <strong>SKU: {item.sku}</strong>
                                    <span className="bom-item-code">Code: {item.item_code}</span>
                                  </div>
                                  <p className="bom-item-description">{item.product_description}</p>
                                  <div className="bom-item-meta">
                                    <span className="bom-item-category">{item.category}</span>
                                    <span className="bom-item-vendor">
                                      <i className="fas fa-truck"></i> {primaryVendor?.name}
                                    </span>
                                    <span className="bom-item-cost">
                                      <i className="fas fa-rupee-sign"></i> {primaryVendor?.cost}
                                    </span>
                                  </div>
                                </div>
                                <button 
                                  className="bom-add-item-btn"
                                  onClick={() => handleAddItemToBOM(bom.id, item)}
                                >
                                  <i className="fas fa-plus"></i>
                                  Add to BOM
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="bom-empty-state small">
                            <i className="fas fa-search"></i>
                            <p>No items available to add</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bom-items-section">
                      <div className="bom-section-header">
                        <h4><i className="fas fa-list"></i>BOM Items List ({bom.items?.length || 0})</h4>
                        <div className="bom-search-box small">
                          <i className="fas fa-search"></i>
                          <input
                            type="text"
                            placeholder="Search BOM items..."
                            value={bomItemsSearch}
                            onChange={(e) => setBomItemsSearch(e.target.value)}
                            className="bom-search-input"
                          />
                        </div>
                      </div>
                      
                      <div className="bom-items-table-container">
                        <table className="bom-items-table">
                          <thead>
                            <tr>
                              <th>SKU</th>
                              <th>Item Code</th>
                              <th>Product Description</th>
                              <th>Category</th>
                              <th>Vendor</th>
                              <th>Cost</th>
                              <th>Quantity</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBomItems(bom).length > 0 ? (
                              filteredBomItems(bom).map(item => (
                                <tr key={item.id} className="bom-item-row">
                                  <td><strong>{item.sku}</strong></td>
                                  <td>{item.item_code}</td>
                                  <td className="bom-truncate">{item.product_description}</td>
                                  <td><span className="bom-category-tag">{item.category}</span></td>
                                  <td>{item.vendor}</td>
                                  <td>{formatRupees(item.cost)}</td>
                                  <td>
                                    {editingQuantity.bomId === bom.id && editingQuantity.itemId === item.id ? (
                                      <div className="bom-quantity-edit">
                                        <input
                                          type="number"
                                          min="1"
                                          value={editingQuantity.value}
                                          onChange={(e) => setEditingQuantity(prev => ({ ...prev, value: e.target.value }))}
                                          className="bom-quantity-input"
                                          autoFocus
                                        />
                                        <div className="bom-quantity-actions">
                                            <button className="bom-save-btn small" onClick={saveQuantity}>
                                            <i className="fas fa-check"></i>
                                          </button>
                                          <button className="bom-cancel-btn small" onClick={cancelEditingQuantity}>
                                            <i className="fas fa-times"></i>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="bom-quantity-display"
                                        onClick={() => startEditingQuantity(bom.id, item.id, item.quantity)}
                                      >
                                
                                        <span>{item.quantity}</span>
                                        <i className="fas fa-edit"></i>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <button 
                                      className="bom-remove-item-btn"
                                      onClick={() => handleDeleteBOMItem(bom.id, item.id)}
                                      title="Remove from BOM"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="8" className="bom-empty-table-message">
                                  <div className="bom-empty-state">
                                    <i className="fas fa-inbox"></i>
                                    <p>No items found in this BOM</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bom-empty-state">
            <i className="fas fa-sitemap"></i>
            <h3>No BOMs Found</h3>
            <p>Create your first BOM to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BOMPage;