import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import AddItemPage from './pages/AddItemPage';
import BOMPage from './pages/BOMPage';
import GenerateIntentPage from './pages/GenerateIntentPage';
import VendorPage from './pages/VendorPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('add-item');
  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [poIntentData, setPoIntentData] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Show notification
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  }, []);

  // Fetch items from Supabase
  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      setItems([]);
      showNotification('Error fetching items', 'error');
    }
  }, [showNotification]);

  // Fetch BOMs from Supabase
  const fetchBOMs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse items from JSON string back to array with proper error handling
      const parsedBoms = (data || []).map(bom => {
        try {
          return {
            ...bom,
            items: bom.items ? JSON.parse(bom.items) : []
          };
        } catch (parseError) {
          console.error('Error parsing BOM items:', parseError, bom);
          return {
            ...bom,
            items: []
          };
        }
      });
      setBoms(parsedBoms);
    } catch (error) {
      console.error('Error fetching BOMs:', error);
      setBoms([]);
      showNotification('Error fetching BOMs', 'error');
    }
  }, [showNotification]);

  // Fetch vendors from Supabase
  const fetchVendors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
      showNotification('Error fetching vendors', 'error');
    }
  }, [showNotification]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchItems(), fetchBOMs(), fetchVendors()]);
      } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchItems, fetchBOMs, fetchVendors, showNotification]);

  // Handle generating PO from intent
  const handleGeneratePO = (intentData) => {
    setPoIntentData(intentData);
    setCurrentPage('purchase-order');
    showNotification('Purchase intent loaded for PO creation!');
  };

  // Memoized page render
  const renderPage = useMemo(() => {
    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
          </div>
          <p>Loading inventory data...</p>
        </div>
      );
    }

    const pageProps = {
      showNotification,
      fetchItems,
      fetchBOMs,
      fetchVendors
    };

    switch (currentPage) {
      case 'add-item':
        return (
          <AddItemPage 
            items={items} 
            setItems={setItems} 
            boms={boms} 
            vendors={vendors}
            onGenerateIntent={() => setCurrentPage('generate-intent')}
            {...pageProps}
          />
        );
      case 'bom':
        return (
          <BOMPage 
            boms={boms} 
            setBoms={setBoms} 
            items={items} 
            setItems={setItems} 
            vendors={vendors}
            onGenerateIntent={() => setCurrentPage('generate-intent')}
            {...pageProps}
          />
        );
      case 'purchase-order':
        return (
          <PurchaseOrderPage 
            vendors={vendors}
            items={items}
            onBack={() => setCurrentPage('add-item')}
            intentData={poIntentData}
            {...pageProps}
          />
        );
      case 'generate-intent':
        return (
          <GenerateIntentPage 
            items={items} 
            boms={boms}
            vendors={vendors}
            onBack={() => setCurrentPage('add-item')}
            onGeneratePO={handleGeneratePO}
            {...pageProps}
          />
        );
      case 'vendors':
        return (
          <VendorPage 
            vendors={vendors}
            setVendors={setVendors}
            {...pageProps}
          />
        );
      default:
        return (
          <AddItemPage 
            items={items} 
            setItems={setItems} 
            boms={boms} 
            vendors={vendors}
            onGenerateIntent={() => setCurrentPage('generate-intent')}
            {...pageProps}
          />
        );
    }
  }, [currentPage, isLoading, items, boms, vendors, poIntentData, showNotification, fetchItems, fetchBOMs, fetchVendors]);

  const getNavIcon = (page) => {
    switch (page) {
      case 'add-item': return 'fas fa-boxes';
      case 'bom': return 'fas fa-sitemap';
      case 'purchase-order': return 'fas fa-file-invoice';
      case 'generate-intent': return 'fas fa-file-invoice-dollar';
      case 'vendors': return 'fas fa-truck';
      default: return 'fas fa-box';
    }
  };

  const getNavText = (page) => {
    switch (page) {
      case 'add-item': return 'Manage Items';
      case 'bom': return 'BOM Management';
      case 'purchase-order': return 'Purchase Orders';
      case 'generate-intent': return 'Generate Intent';
      case 'vendors': return 'Vendors';
      default: return 'Manage Items';
    }
  };

  return (
    <div className="app">
      {/* Notification System */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <i className={`fas ${
            notification.type === 'success' ? 'fa-check-circle' : 
            notification.type === 'error' ? 'fa-exclamation-circle' : 
            'fa-info-circle'
          }`}></i>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <i className="fas fa-warehouse"></i>
            </div>
            <div className="logo-text">
              <h1>InventoryPro</h1>
              <p>Kinya Medical System</p>
            </div>
          </div>
          
          <nav className="nav-menu">
            {['add-item', 'bom', 'vendors', 'purchase-order', 'generate-intent'].map(page => (
              <button 
                key={page}
                className={`nav-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                <i className={getNavIcon(page)}></i>
                <span>{getNavText(page)}</span>
                {currentPage === page && <div className="nav-indicator"></div>}
              </button>
            ))}
          </nav>
          
          <div className="header-actions">
            <div className="stats-badge">
              <i className="fas fa-box"></i>
              <span>{items.length} Items</span>
            </div>
            <div className="stats-badge">
              <i className="fas fa-sitemap"></i>
              <span>{boms.length} BOMs</span>
            </div>
            <div className="stats-badge">
              <i className="fas fa-truck"></i>
              <span>{vendors.length} Vendors</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="app-main">
        {renderPage}
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; 2025 Kinya Medical System Solutions. All rights reserved.</p>
          <div className="footer-links">
            <span>Inventory Management System v2.1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;