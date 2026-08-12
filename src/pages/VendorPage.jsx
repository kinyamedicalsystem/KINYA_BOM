import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import "./VendorPage.css"
import { faL } from '@fortawesome/free-solid-svg-icons';

const VendorPage = ({ vendors, setVendors, fetchVendors, showNotification }) => {
  const [formData, setFormData] = useState({
    vendor_name: '',
    phone: '',
    address: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
//Popups
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
//Popups
  const [pendingStatus, setPendingStatus] = useState('');

  const vendorStats = useMemo(() => ({  
    total: vendors.length,
    approved: vendors.filter(v => v.status === 'Approved').length,
    pending: vendors.filter(v => v.status === 'Pending').length,
    rejected: vendors.filter(v => v.status === 'Rejected').length
  }), [vendors]);

  const filteredVendors = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return vendors.filter(vendor => {
      const matchesSearch = 
        vendor.vendor_name?.toLowerCase().includes(lowerSearchTerm) ||
        vendor.phone?.toLowerCase().includes(lowerSearchTerm) ||
        vendor.address?.toLowerCase().includes(lowerSearchTerm);
      
      const matchesStatusFilter = statusFilter ? vendor.status === statusFilter : true;
      
      return matchesSearch && matchesStatusFilter;
    });
  }, [vendors, searchTerm, statusFilter]);

  const handleSave = async () => {
    if (isSaving) return;
    
    if (!formData.vendor_name.trim()) {
      showNotification('Vendor Name is required', 'error');
      return;
    }

    setIsSaving(true);

    const vendorData = {
      vendor_name: formData.vendor_name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      status: 'Pending',
      updated_at: new Date().toISOString()
    };

    try {
      let error;
      
      if (editingId) {
        const { error: updateError } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', editingId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('vendors')
          .insert([{ ...vendorData, created_at: new Date().toISOString() }]);
        error = insertError;
      }

      if (error) throw error;

      await fetchVendors();
      resetForm();
      showNotification(editingId ? 'Vendor updated successfully!' : 'Vendor added successfully!', 'success');
    } catch (error) {
      console.error('Error saving vendor:', error);
      showNotification('Error saving vendor. Please check your connection and try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = useCallback((vendor) => {
    setFormData({
      vendor_name: vendor.vendor_name,
      phone: vendor.phone,
      address: vendor.address
    });
    setEditingId(vendor.id);
  }, []);

  const handleDelete = async () => {
      try {
        const { error } = await supabase
          .from('vendors')
          .delete()
          .eq('id', vendorToDelete);

        if (error) throw error;

        await fetchVendors();
        showNotification('Vendor deleted successfully!', 'success');
        setShowDeletePopup(false);
        setVendorToDelete(null)
      } catch (error) {
        console.error('Error deleting vendor:', error);
        showNotification('Error deleting vendor. Please check your connection and try again.', 'error');
      }
    
  };

  const showStatusChangePopup = (vendor, newStatus) => {
    setSelectedVendor(vendor);
    setPendingStatus(newStatus);
    setShowStatusPopup(true);
  };

  const handleStatusChangeConfirmed = async () => {
    if (!selectedVendor) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          status: pendingStatus,
          updated_at: new Date().toISOString()
         })
         .eq('id', selectedVendor.id);

      if (error) throw error;

      await fetchVendors();
      setShowStatusPopup(false);
      setSelectedVendor(null);
      setPendingStatus('');
      showNotification(`Vendor status updated to ${pendingStatus}!`, 'success');
    } catch (error) {
      console.error('Error updating vendor status:', error);
      showNotification('Error updating vendor status. Please check your connection and try again.', 'error');
    }
  };

  const resetForm = useCallback(() => {
    setFormData({
      vendor_name: '',
      phone: '',
      address: ''
    });
    setEditingId(null);
  }, []);
  
  const getStatusBadgeClass = useCallback((status) => {
    switch (status) {
      case 'Approved': return 'status-approved';
      case 'Rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }, []);

  return (
    <div className="vendor-page">
      {/* Status Change Confirmation Popup */}
      {showStatusPopup && (
        <div className="vendor-popup-overlay">
          <div className="vendor-popup-content">
            <div className="vendor-popup-header">
              <h3>Confirm Status Change</h3>
              <button 
                className="vendor-popup-close"
                onClick={() => setShowStatusPopup(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="vendor-popup-body">
              <p>
                Are you sure you want to change the status of <strong>{selectedVendor?.vendor_name}</strong> to <strong>{pendingStatus}</strong>?
              </p>
            </div>
            <div className="vendor-popup-actions">
              <button 
                className="vendor-btn vendor-btn-secondary"
                onClick={() => setShowStatusPopup(false)}
              >
                Cancel
              </button>
              <button 
                className={`vendor-btn ${pendingStatus === 'Approved' ? 'vendor-btn-success' : 'vendor-btn-danger'}`}
                onClick={handleStatusChangeConfirmed}
              >
                Confirm {pendingStatus}
              </button>
            </div>
          </div>
        </div>
      )}

    {showDeletePopup && (
      <div className="vendor-popup-overlay">
          <div className="vendor-popup-content">
            <div className="vendor-popup-header">
              <h3>Delete Vendor</h3>
              <button 
                className="vendor-popup-close"
                onClick={() =>  {setShowDeletePopup(false);
            setVendorToDelete(null)}}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="vendor-popup-body">
              
      <p>Are you sure you want to delete this vendor?</p>
            </div>
            <div className="vendor-popup-actions">
               <button
          className="vendor-btn vendor-btn-secondary"
          onClick={() => {
            setShowDeletePopup(false);
            setVendorToDelete(null);
          }}
        >
          Cancel
        </button>
              <button
          className="vendor-btn vendor-btn-danger"
          onClick={handleDelete}
        >
          Delete
        </button>
            </div>
          </div>
        </div>    
  
)}

      <div className="vendor-header">
        <div className="vendor-title-section">
          <h2><i className="fas fa-truck"></i>Vendor Management</h2>
          <p>Add, edit, or manage vendor information</p>
        </div>
      </div>

      <div className="vendor-stats">
        <div className="vendor-stat-card">
          <div className="vendor-stat-icon orange">
            <i className="fas fa-truck"></i>
          </div>
          <div className="vendor-stat-info">
            <h3>{vendorStats.total}</h3>
            <p>Total Vendors</p>
          </div>
        </div>
        <div className="vendor-stat-card">
          <div className="vendor-stat-icon green">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="vendor-stat-info">
            <h3>{vendorStats.approved}</h3>
            <p>Approved</p>
          </div>
        </div>
        <div className="vendor-stat-card">
          <div className="vendor-stat-icon yellow">
            <i className="fas fa-clock"></i>
          </div>
          <div className="vendor-stat-info">
            <h3>{vendorStats.pending}</h3>
            <p>Pending</p>
          </div>
        </div>
      </div>

      <div className="vendor-form-container">
        <div className="vendor-form-header">
          <h3>
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-plus-circle'}`}></i>
            {editingId ? 'Edit Vendor' : 'Add New Vendor'}
          </h3>
          {editingId && (
            <button className="vendor-cancel-btn" onClick={resetForm}>
              <i className="fas fa-times"></i>
              Cancel Edit
            </button>
          )}
        </div>
        
        <div className="vendor-form-grid">
          <div className="vendor-form-group full-width">
            <label><i className="fas fa-building"></i>Vendor Name *</label>
            <input
              type="text"
              value={formData.vendor_name}
              onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
              placeholder="Enter vendor company name"
              className="vendor-form-input"
            />
          </div>

          <div className="vendor-form-group">
            <label><i className="fas fa-phone"></i>Phone Number</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter phone number"
              className="vendor-form-input"
            />
          </div>

          <div className="vendor-form-group full-width">
            <label><i className="fas fa-map-marker-alt"></i>Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter vendor address"
              rows="3"
              className="vendor-form-input"
            />
          </div>
        </div>

        <div className="vendor-form-actions">
          <button 
            className={`vendor-save-btn ${isSaving ? 'loading' : ''}`} 
            onClick={handleSave}
            disabled={isSaving}
          >
            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
            {isSaving ? 'Saving...' : (editingId ? 'Update Vendor' : 'Save Vendor')}
          </button>
        </div>
      </div>

      <div className="vendor-list-controls">
        <div className="vendor-search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search vendors by name, phone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="vendor-search-input"
          />
        </div>
        <div className="vendor-filter-control">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="vendor-filter-select"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="vendor-table-container">
        <table className="vendor-data-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map(vendor => (
              <tr key={vendor.id}>
                <td><strong>{vendor.vendor_name}</strong></td>
                <td>{vendor.phone}</td>
                <td className="vendor-truncate">{vendor.address}</td>
                <td>
                  <span className={`vendor-status-badge ${getStatusBadgeClass(vendor.status)}`}>
                    {vendor.status}
                  </span>
                </td>
                <td>{new Date(vendor.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="vendor-action-buttons">
                    <div className="vendor-status-actions">
                      <button 
                        onClick={() => showStatusChangePopup(vendor, 'Approved')}
                        className={`vendor-btn-icon approve ${vendor.status === 'Approved' ? 'active' : ''}`}
                        title="Approve Vendor"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                      <button 
                        onClick={() => showStatusChangePopup(vendor, 'Rejected')}
                        className={`vendor-btn-icon reject ${vendor.status === 'Rejected' ? 'active' : ''}`}
                        title="Reject Vendor"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <button 
                      onClick={() => handleEdit(vendor)} 
                      className="vendor-btn-icon edit" 
                      title="Edit Vendor"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      onClick={() => {setVendorToDelete(vendor.id);
                        setShowDeletePopup(true);
                      }} 
                      className="vendor-btn-icon delete" 
                      title="Delete Vendor"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredVendors.length === 0 && (
        <div className="vendor-empty-state">
          <i className="fas fa-truck"></i>
          <h3>No vendors found</h3>
          <p>{searchTerm || statusFilter ? 'Try changing your search or filter' : 'Start by adding your first vendor'}</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(VendorPage);