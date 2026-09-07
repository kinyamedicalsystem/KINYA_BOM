import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import "./AddItemPage.css"

const AddItemPage = ({ items, boms, fetchItems, onGenerateIntent, vendors, showNotification }) => {
  const [formData, setFormData] = useState({
    sku: '',
    item_code: '',
    product_description: '',
    category: '',
    order_link: '',
    vendors: [{ name: '', cost: '', partCode: '', primary: true }],
    bom_id: '',
    bom_name: ''
  });

  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBomFilter, setSelectedBomFilter] = useState('');
  const [activeTab, setActiveTab] = useState('form');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  // Popup states
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [vendorDropdown, setVendorDropdown] = useState(null);


  // Get unique categories from existing items
  const existingCategories = [...new Set(items.map(item => item.category).filter(Boolean))];

  // Auto-hide popups after 3 seconds
  useEffect(() => {
    if (showSuccessPopup || showErrorPopup) {
      const timer = setTimeout(() => {
        setShowSuccessPopup(false);
        setShowErrorPopup(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessPopup, showErrorPopup]);

  const showPopup = (type, message) => {
    setPopupMessage(message);
    if (type === 'success') {
      setShowSuccessPopup(true);
    } else {
      setShowErrorPopup(true);
    }
  };

///*******************************  VENDOR MANAGEMENT  *******************************************///
//---Handle New Vendor--
  const handleAddVendor = () => {
    setFormData(prev => ({
      ...prev,
      vendors: [...prev.vendors, { name: '', cost: '', partCode: '', primary: false }]
    }));
  };

//---Handle Vendor Change--
  const handleVendorChange = (index, field, value) => {
    const updatedVendors = formData.vendors.map((vendor, i) =>
      i === index ? { ...vendor, [field]: value } : vendor
    );
    setFormData(prev => ({ ...prev, vendors: updatedVendors }));
  };

//---Select the vendor it has been approved through the dropdown--
  const handleVendorSelection = (index, vendorName) => {
    const selectedVendor = vendors.find(v => v.vendor_name === vendorName);
    if (selectedVendor) {
      const updatedVendors = formData.vendors.map((vendor, i) =>
        i === index ? { ...vendor, name: vendorName } : vendor
      );
      setFormData(prev => ({ ...prev, vendors: updatedVendors }));
    }
  };

//---Set Primary Vendor--
  const setPrimaryVendor = (index) => {
    const updatedVendors = formData.vendors.map((vendor, i) => ({
      ...vendor,
      primary: i === index
    }));
    setFormData(prev => ({ ...prev, vendors: updatedVendors }));
  };

//---Set Primary inside the dropdown--
  const makeVendorPrimary = async (item, selectedVendor) => {
    try {
      // Parse existing vendors
      let vendors = [];

      try {
        vendors = item.vendors ? JSON.parse(item.vendors) : [];
      } catch (error) {
        console.error("Error parsing vendors:", error);
        return;
      }

      // Change primary status
      const updatedVendors = vendors.map(vendor => ({
        ...vendor,
        primary: vendor.name === selectedVendor.name
      }));

      // Update Supabase
      const { error } = await supabase
        .from('items')
        .update({
          vendors: JSON.stringify(updatedVendors),
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;

      // Refresh items
      await fetchItems();

      // Close dropdown
      setVendorDropdown(null);

      showPopup('success', `${selectedVendor.name} is now the primary vendor`);

    } catch (error) {
      console.error("Error changing primary vendor:", error);
      showPopup('error', 'Failed to change primary vendor');
    }
  };

//---Calculate total primary vendorr cost--
  const getPrimaryVendorCost = (item) => {
  try {
    const itemVendors = item.vendors
      ? JSON.parse(item.vendors)
      : [];

    const primaryVendor =
      itemVendors.find(vendor => vendor.primary) || itemVendors[0];

    return Math.round(Number(primaryVendor?.cost) || 0);
 
  } catch (error) {
    console.error("Error calculating vendor cost:", error);
    return 0;
  }
};

//---Remove Vendors---
  const removeVendor = (index) => {
    if (formData.vendors.length <= 1) return;
    const updatedVendors = formData.vendors.filter((_, i) => i !== index);
    if (updatedVendors.length > 0 && !updatedVendors.some(v => v.primary)) {
      updatedVendors[0].primary = true;
    }
    setFormData(prev => ({ ...prev, vendors: updatedVendors }));
  };

  ///*******************************  BOM MANAGEMENT  *******************************************/// 
  //Handle BOM change through the dropdown
  const handleBOMChange = (bomId) => {
    const selectedBOM = boms.find(bom => bom.id === bomId);
    setFormData(prev => ({
      ...prev,
      bom_id: bomId,
      bom_name: selectedBOM ? selectedBOM.bom_name : ''
    }));
  };

  ///******************************* CATEGORY MANAGEMENT *******************************************///  
  const handleCategoryChange = (value) => {
    if (value === 'new') {
      setShowNewCategory(true);
      setFormData(prev => ({ ...prev, category: '' }));
    } else {
      setShowNewCategory(false);
      setFormData(prev => ({ ...prev, category: value }));
    }
  };

  ///******************************* CRUD OPERATIONS(Add,Edit,Delete)*******************************************/// 
  //1.Save items in Database
  const handleSave = async () => {
    if (isSaving) return;

    if (!formData.sku || !formData.item_code) {
      showPopup('error', 'SKU and Item Code are required');
      return;
    }

    // Check for duplicate SKU
    const { data: existingItem } = await supabase
      .from('items')
      .select('id')
      .eq('sku', formData.sku)
      .neq('id', editingId || '')
      .single();

    if (existingItem) {
      showPopup('error', 'SKU must be unique');
      return;
    }
    setIsSaving(true);

    const vendorsJSON = JSON.stringify(formData.vendors);
    const finalCategory = showNewCategory && newCategory ? newCategory : formData.category;

    const itemData = {
      sku: formData.sku,
      item_code: formData.item_code,
      product_description: formData.product_description,
      category: finalCategory,
      order_link: formData.order_link,
      vendors: vendorsJSON,
      bom_id: formData.bom_id || null,
      bom_name: formData.bom_name || null,
      updated_at: new Date().toISOString()
    };

    try {
      let error;

      if (editingId) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', editingId);
        error = updateError;
      } else {
        // Insert new item
        const { error: insertError } = await supabase
          .from('items')
          .insert([{ ...itemData, created_at: new Date().toISOString() }]);
        error = insertError;
      }

      if (error) throw error;

      await fetchItems();
      resetForm();
      showPopup('success', editingId ? 'Item updated successfully!' : 'Item added successfully!');
    } catch (error) {
      console.error('Error saving item:', error);
      showPopup('error', 'Error saving item. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };


  //2.Edit items and update into the Database
  const handleEdit = (item) => {
    let vendors = [];
    try {
      vendors = item.vendors ? JSON.parse(item.vendors) : [{ name: '', cost: '', partCode: '', primary: true }];
    } catch (error) {
      console.error('Error parsing vendors:', error);
      vendors = [{ name: '', cost: '', partCode: '', primary: true }];
    }

    setFormData({
      sku: item.sku || '',
      item_code: item.item_code || '',
      product_description: item.product_description || '',
      category: item.category || '',
      order_link: item.order_link || '',
      vendors: vendors,
      bom_id: item.bom_id || '',
      bom_name: item.bom_name || ''
    });
    setEditingId(item.id);
    setActiveTab('form');
    setShowNewCategory(false);
    setNewCategory('');
  };


  //Delete Confirmation
  const confirmDelete = (item) => {
    setItemToDelete(item);
    setShowDeletePopup(true);
  };

  //3.Delete thh items from the database
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      await fetchItems();
      showPopup('success', 'Item deleted successfully!');
    } catch (error) {
      console.error('Error deleting item:', error);
      showPopup('error', 'Error deleting item. Please check your connection and try again.');
    } finally {
      setShowDeletePopup(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeletePopup(false);
    setItemToDelete(null);
  };

  //Reset Form
  const resetForm = () => {
    setFormData({
      sku: '',
      item_code: '',
      product_description: '',
      category: '',
      order_link: '',
      vendors: [{ name: '', cost: '', partCode: '', primary: true }],
      bom_id: '',
      bom_name: ''
    });
    setEditingId(null);
    setShowNewCategory(false);
    setNewCategory('');
  };

  //Filter items based in item_code,product_description
  const filteredItems = items.filter(item => {
    const matchesSearch = item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBomFilter = selectedBomFilter ? item.bom_id === selectedBomFilter : true;

    return matchesSearch && matchesBomFilter;
  });

  const individualItems = filteredItems.filter(item => !item.bom_id);
  const individualTotalCost = individualItems.reduce((total, item) => total + getPrimaryVendorCost(item), 0);

  const bomGroups = boms.map(bom => {
    const bomItems=filteredItems.filter(item => item.bom_id === bom.id)
    const totalCost=bomItems.reduce((total,item)=>total+getPrimaryVendorCost(item),0)

    return{
      bom,
      items:bomItems,
      totalCost
    };

  }).filter(group => group.items.length > 0);

  console.log(bomGroups)


  const approvedVendors = vendors.filter(vendor => vendor.status === 'Approved');

  return (
    <div className="add-item-page">
      {/* Popup components */}
      {showSuccessPopup && (
        <div className="add-item-popup-overlay">
          <div className="add-item-popup-content success-popup">
            <div className="add-item-popup-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="add-item-popup-message">
              <h4>Success!</h4>
              <p>{popupMessage}</p>
            </div>
            <button className="add-item-popup-close" onClick={() => setShowSuccessPopup(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}


      {showErrorPopup && (
        <div className="add-item-popup-overlay">
          <div className="add-item-popup-content error-popup">
            <div className="add-item-popup-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <div className="add-item-popup-message">
              <h4>Error!</h4>
              <p>{popupMessage}</p>
            </div>
            <button className="add-item-popup-close" onClick={() => setShowErrorPopup(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {showDeletePopup && (
        <div className="add-item-popup-overlay">
          <div className="add-item-confirmation-popup">
            <div className="add-item-popup-header">
              <i className="fas fa-exclamation-triangle"></i>
              <h3>Confirm Delete</h3>
            </div>
            <div className="add-item-popup-body">
              <p>Are you sure you want to delete <strong>"{itemToDelete?.sku}"</strong>?</p>
              <p className="add-item-warning-text">This action cannot be undone.</p>
            </div>
            <div className="add-item-popup-actions">
              <button className="add-item-btn add-item-btn-secondary" onClick={cancelDelete}>
                <i className="fas fa-times"></i>
                Cancel
              </button>
              <button className="add-item-btn add-item-btn-danger" onClick={handleDelete}>
                <i className="fas fa-trash"></i>
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="add-item-header">
        <div className="add-item-title-section">
          <h2><i className="fas fa-boxes"></i>Manage Items</h2>
          <p>Add, edit, or delete inventory items</p>
        </div>
        <div className="add-item-header-actions">
          <button className="add-item-generate-btn" onClick={onGenerateIntent}>
            <i className="fas fa-file-invoice-dollar"></i>
            Generate Purchase Intent
          </button>
        </div>
      </div>

      <div className="add-item-stats">
        <div className="add-item-stat-card">
          <div className="add-item-stat-icon blue">
            <i className="fas fa-box"></i>
          </div>
          <div className="add-item-stat-info">
            <h3>{items.length}</h3>
            <p>Total Items</p>
          </div>
        </div>
        <div className="add-item-stat-card">
          <div className="add-item-stat-icon green">
            <i className="fas fa-cube"></i>
          </div>
          <div className="add-item-stat-info">
            <h3>{individualItems.length}</h3>
            <p>Individual Items</p>
          </div>
        </div>
        <div className="add-item-stat-card">
          <div className="add-item-stat-icon purple">
            <i className="fas fa-sitemap"></i>
          </div>
          <div className="add-item-stat-info">
            <h3>{boms.length}</h3>
            <p>BOMs</p>
          </div>
        </div>
      </div>

      <div className="add-item-tabs">
        <button
          className={`add-item-tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          <i className="fas fa-edit"></i>
          {editingId ? 'Edit Item' : 'Add New Item'}
        </button>
        <button
          className={`add-item-tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <i className="fas fa-list"></i>
          View All Items ({filteredItems.length})
        </button>
      </div>
      {activeTab === 'form' && (
        <div className="add-item-form-container">
          <div className="add-item-form-header">
            <h3>
              <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus-circle'}`}></i>
              {editingId ? 'Edit Item' : 'Add New Item'}
            </h3>
            {editingId && (
              <button className="add-item-cancel-btn" onClick={resetForm}>
                <i className="fas fa-times"></i>
                Cancel Edit
              </button>
            )}
          </div>

          <div className="add-item-form-grid">
            <div className="add-item-form-group">
              <label><i className="fas fa-barcode"></i>SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="Enter unique SKU"
                className="add-item-form-input"
              />
            </div>

            <div className="add-item-form-group">
              <label><i className="fas fa-tag"></i>Item Code *</label>
              <input
                type="text"
                value={formData.item_code}
                onChange={(e) => setFormData(prev => ({ ...prev, item_code: e.target.value }))}
                placeholder="Enter item code"
                className="add-item-form-input"
              />
            </div>

            <div className="add-item-form-group full-width">
              <label><i className="fas fa-align-left"></i>Product Description</label>
              <textarea
                value={formData.product_description}
                onChange={(e) => setFormData(prev => ({ ...prev, product_description: e.target.value }))}
                placeholder="Enter product description"
                rows="3"
                className="add-item-form-input"
              />
            </div>

            <div className="add-item-form-group">
              <label><i className="fas fa-folder"></i>Category</label>
              <div className="add-item-category-selector">
                <select
                  value={showNewCategory ? 'new' : formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="add-item-form-input"
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
                    className="add-item-form-input add-item-new-category-input"
                  />
                )}
              </div>
            </div>

            <div className="add-item-form-group">
              <label><i className="fas fa-sitemap"></i>Select BOM</label>
              <select
                value={formData.bom_id}
                onChange={(e) => handleBOMChange(e.target.value)}
                className="add-item-form-input"
              >
                <option value="">Individual (No BOM)</option>
                {boms.map(bom => (
                  <option key={bom.id} value={bom.id}>
                    {bom.bom_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="add-item-form-group full-width">
              <label><i className="fas fa-link"></i>Order Link</label>
              <textarea
                value={formData.order_link}
                onChange={(e) => setFormData(prev => ({ ...prev, order_link: e.target.value }))}
                placeholder="Enter order link"
                rows="2"
                className="add-item-form-input"
              />
            </div>
          </div>

          <div className="add-item-vendors-section">
            <div className="add-item-section-header">
              <label><i className="fas fa-truck"></i>Vendors Information</label>
              <button type="button" className="add-item-add-vendor-btn" onClick={handleAddVendor}>
                <i className="fas fa-plus"></i>
                Add Vendor
              </button>
            </div>

            {formData.vendors.map((vendor, index) => (
              <div key={index} className="add-item-vendor-card">
                <div className="add-item-vendor-inputs">
                  <div className="add-item-vendor-dropdown-container">
                    <select
                      value={vendor.name}
                      onChange={(e) => handleVendorSelection(index, e.target.value)}
                      className="add-item-form-input add-item-vendor-dropdown"
                    >
                      <option value="">Select Vendor</option>
                      {approvedVendors.map(vendor => (
                        <option key={vendor.id} value={vendor.vendor_name}>
                          {vendor.vendor_name}
                        </option>
                      ))}
                    </select>
                    {!vendor.name && (
                      <div className="add-item-vendor-hint">
                        <small>Or enter vendor name manually below</small>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Vendor Company Name"
                    value={vendor.name}
                    onChange={(e) => handleVendorChange(index, 'name', e.target.value)}
                    className="add-item-form-input"
                  />

                  <input
                    type="text"
                    placeholder="Vendor item Code"
                    value={vendor.partCode}
                    onChange={(e) => handleVendorChange(index, 'partCode', e.target.value)}
                    className="add-item-form-input"
                  />
                  <input
                    type="number"
                    placeholder="Item Cost"
                    value={vendor.cost}
                    onChange={(e) => handleVendorChange(index, 'cost', e.target.value)}
                    step="0.01"
                    min="0"
                    className="add-item-form-input"
                  />
                </div>
                <div className="add-item-vendor-actions">
                  <button
                    type="button"
                    className={`add-item-primary-btn ${vendor.primary ? 'active' : ''}`}
                    onClick={() => setPrimaryVendor(index)}
                    disabled={vendor.primary}
                  >
                    <i className={`fas ${vendor.primary ? 'fa-star' : 'fa-star'}`}></i>
                    {vendor.primary ? 'Primary Vendor' : 'Set as Primary'}
                  </button>
                  {formData.vendors.length > 1 && (
                    <button
                      type="button"
                      className="add-item-danger-btn"
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

          <div className="add-item-form-actions">
            <button
              className={`add-item-save-btn ${isSaving ? 'loading' : ''}`}
              onClick={handleSave}
              disabled={isSaving}
            >
              <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
              {isSaving ? 'Saving...' : (editingId ? 'Update Item' : 'Save Item')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="add-item-items-list">
          <div className="add-item-list-controls">
            <div className="add-item-search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search items by SKU, Item Code, or Description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="add-item-search-input"
              />
            </div>
            <div className="add-item-filter-control">
              <select
                value={selectedBomFilter}
                onChange={(e) => setSelectedBomFilter(e.target.value)}
                className="add-item-filter-select"
              >
                <option value="">All Items</option>
                <option value="">Individual Items</option>
                {boms.map(bom => (
                  <option key={bom.id} value={bom.id}>
                    {bom.bom_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(!selectedBomFilter || selectedBomFilter === '') && individualItems.length > 0 && (
            <div className="add-item-items-section">
              <div className="add-item-section-header">
                <h4><i className="fas fa-cube"></i>Individual Items ({individualItems.length})</h4>
                <h4 className='add-item-totalcost'>TotalCost : ₹ {individualTotalCost}</h4>
              </div>
              <div className="add-item-table-container">
                <table className="add-item-data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Primary Vendor</th>
                      <th>BOM</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualItems.map(item => {
                      let vendors = [];
                      try {
                        vendors = item.vendors ? JSON.parse(item.vendors) : [];

                      } catch (error) {
                        console.error('Error parsing vendors:', error);
                      }
                      const primaryVendor = vendors.find(v => v.primary) || vendors[0];
                      const secondaryVendor = vendors.filter(v => !v.primary);
                      console.log(secondaryVendor)
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.sku}</strong></td>
                          <td>{item.item_code}</td>
                          <td className="add-item-truncate">{item.product_description}</td>
                          <td><span className="add-item-category-tag">{item.category}</span></td>
                          <td>
                            {primaryVendor ? (
                              <div className="add-item-vendor-info">
                                <div className="add-item-vendor-details">
                                  <span className="add-item-vendor-name">{primaryVendor.name}</span>
                                  <span className="add-item-vendor-code">{primaryVendor.partCode}</span>
                                  <span className="add-item-vendor-cost"> ₹{primaryVendor.cost}</span>
                                </div>
                                <div>
                                  {secondaryVendor.length > 0 ? (
                                    <button className="add-item-btn-icon change" onClick={() => setVendorDropdown(vendorDropdown === item.id ? null : item.id)}><i className="fa-solid fa-caret-down"></i></button>) : ""}
                                </div>
                              </div>
                            ) : 'No vendor'}
                            {vendorDropdown === item.id && secondaryVendor.length > 0 && (
                              <div className='additem-vendor-dropdown'>
                                {secondaryVendor.map(vendor => (
                                  <div className="vendor-dropdown" onClick={() => makeVendorPrimary(item, vendor)}>
                                    <div className="vendor-dropdown-list">
                                      <span className="vendor-dropdown-name">{vendor.name}</span>
                                      <span className="vendor-dropdown-code">{vendor.partCode}</span>
                                    </div>
                                    <span className="vendor-dropdown-cost"> ₹{vendor.cost}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td><span className="add-item-bom-tag individual">Individual</span></td>
                          <td>
                            <div className="add-item-action-buttons">
                              <button onClick={() => handleEdit(item)} className="add-item-btn-icon edit" title="Edit Item">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button onClick={() => confirmDelete(item)} className="add-item-btn-icon delete" title="Delete Item">
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bomGroups.map(({ bom, items: bomItems,totalCost }) => (
            <div key={bom.id} className="add-item-items-section">
              <div className="add-item-section-header">
                <h4><i className="fas fa-sitemap"></i>{bom.bom_name} Items ({bomItems.length}) </h4>
                <h4 className='add-item-totalcost'>TotalCost : ₹ {totalCost} </h4>
              </div>
              <div className="add-item-table-container">
                <table className="add-item-data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Primary Vendor</th>
                      <th>BOM</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomItems.map(item => {
                      let vendors = [];
                      try {
                        vendors = item.vendors ? JSON.parse(item.vendors) : [];
                      } catch (error) {
                        console.error('Error parsing vendors:', error);
                      }
                      const primaryVendor = vendors.find(v => v.primary) || vendors[0];
                      const secondaryVendor = vendors.filter(v => !v.primary);
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.sku}</strong></td>
                          <td>{item.item_code}</td>
                          <td className="add-item-truncate">{item.product_description}</td>
                          <td><span className="add-item-category-tag">{item.category}</span></td>
                          <td>
                            {primaryVendor ? (
                              <div className="add-item-vendor-info">
                                <div className="add-item-vendor-details">
                                  <span className="add-item-vendor-name">{primaryVendor.name}</span>
                                  <span className="add-item-vendor-code">{primaryVendor.partCode}</span>
                                  <span className="add-item-vendor-cost"> ₹{primaryVendor.cost}</span>
                                </div>
                                <div>
                                  {secondaryVendor.length > 0 ? (
                                    <button className="add-item-btn-icon change" onClick={() => setVendorDropdown(vendorDropdown === item.id ? null : item.id)}><i className="fa-solid fa-caret-down"></i></button>) : ''}
                                </div>
                              </div>
                            ) : 'No vendor'}
                            {vendorDropdown === item.id && secondaryVendor.length > 0 && (
                              <div className='additem-vendor-dropdown'>
                                {secondaryVendor.map(vendor => (
                                  <div className="vendor-dropdown" onClick={() => makeVendorPrimary(item, vendor)}>
                                    <div className="vendor-dropdown-list" >
                                      <span className="vendor-dropdown-name">{vendor.name}</span>
                                      <span className="vendor-dropdown-code">{vendor.partCode}</span>
                                    </div>
                                    <span className="vendor-dropdown-cost"> ₹{vendor.cost}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                          </td>
                          <td><span className="add-item-bom-tag">{item.bom_name}</span></td>
                          <td>
                            <div className="add-item-action-buttons">
                              <button onClick={() => handleEdit(item)} className="add-item-btn-icon edit" title="Edit Item">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button onClick={() => confirmDelete(item)} className="add-item-btn-icon delete" title="Delete Item">
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="add-item-empty-state">
              <i className="fas fa-search"></i>
              <h3>No items found</h3>
              <p>{searchTerm ? 'Try a different search term' : 'Start by adding your first item'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddItemPage;