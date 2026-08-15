import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import 'bootstrap/dist/css/bootstrap.min.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { hasTabAccess } from './roleConfig';

// LIVE BACKEND BASE URL (NO TRAILING SLASH)
const BASE_URL = 'https://my-ecommerce-admin.onrender.com';

// 🟢 HELPER 1: DETECT IF RUNNING AS INSTALLED STANDALONE APP
const isRunningStandalone = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
};

// Helper to sanitize old localhost image urls
const getCleanImageUrl = (url) => {
  if (!url) return '';
  if (typeof url === 'string' && url.includes('localhost:5000')) {
    return url.replace('http://localhost:5000', BASE_URL);
  }
  return url;
};

// HELPER: CLEAN STOCK NUMERIC CONVERTER
const parseCleanStock = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const cleanStr = String(val).replace(/[^0-9]/g, '');
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
};

function App() {
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // 📲 NATIVE PWA INSTALL PROMPT STATE FOR ADMIN
  const [installPrompt, setInstallPrompt] = useState(null);

  // SIDEBAR TOGGLE STATE
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [banners, setBanners] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [csvFile, setCsvFile] = useState(null);

  // 🌳 NESTED CATEGORIES ENGINE STATES
  const [categoryTree, setCategoryTree] = useState([]);
  const [rawCategoriesList, setRawCategoriesList] = useState([]);
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [newNestedCategoryName, setNewNestedCategoryName] = useState('');

  // ADMIN USERS MANAGEMENT STATES
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState(null);
  const [adminFormData, setAdminFormData] = useState({ name: '', email: '', password: '', role: 'Admin', mobile: '' });

  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // CUSTOMERS TAB FILTER STATE
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [selectedTargetCustomer, setSelectedTargetCustomer] = useState(null);
  const [showPersonalDiscountModal, setShowPersonalDiscountModal] = useState(false);
  const [personalCouponCode, setPersonalCouponCode] = useState('');
  const [personalCouponDiscount, setPersonalCouponDiscount] = useState('20');

  const [coupons, setCoupons] = useState([]);

  // 🟢 PRODUCT STATE & MULTIPLE IMAGES GALLERY
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategoryPath, setSelectedCategoryPath] = useState(['General']);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [images, setImages] = useState([]);
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [stock, setStock] = useState(0);
  const [productPriority, setProductPriority] = useState(100);
  const [rankInputs, setRankInputs] = useState({});

  // 🟢 100% DYNAMIC ATTRIBUTES & VARIANTS BUILDER
  const [dynamicAttributeNames, setDynamicAttributeNames] = useState(['Size', 'Color']);
  const [newAttributeNameInput, setNewAttributeNameInput] = useState('');
  const [variants, setVariants] = useState([]);
  const [variantInputs, setVariantInputs] = useState({});
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');

  // 🟢 BANNER STATE (WITH PRIORITY RANK)
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBadge, setBannerBadge] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [bannerBg, setBannerBg] = useState('linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)');
  const [bannerPriority, setBannerPriority] = useState(1);

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('');
  const [newCouponCategory, setNewCouponCategory] = useState('All');
  const [newCouponMaxUsage, setNewCouponMaxUsage] = useState(50);

  // 📲 PWA INSTALL EVENT LISTENER
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      if (!isRunningStandalone()) {
        setInstallPrompt(e);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
      alert('🎉 TechStore Admin App installed successfully on your device!');
    });

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallAdminApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      alert("📱 To install Admin App:\n1. Tap browser menu (⋮)\n2. Click 'Install App' or 'Add to Home Screen'!");
    }
  };

  const handleTabSelect = (tabName) => {
    setActiveTab(tabName);
    setSidebarOpen(false);
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const determineRole = (email, backendRole) => {
    const emailLower = (email || '').toLowerCase();
    if (emailLower.includes('inventory') || emailLower.includes('manager') || emailLower.includes('gf')) {
      return 'InventoryManager';
    }
    if (emailLower.includes('staff') || emailLower.includes('support')) {
      return 'Staff';
    }
    if (backendRole && backendRole.toLowerCase().includes('inventory')) return 'InventoryManager';
    if (backendRole && backendRole.toLowerCase().includes('staff')) return 'Staff';
    return backendRole || 'SuperAdmin';
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('adminUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        const userRole = determineRole(parsedUser.email, parsedUser.role);

        setUser({ ...parsedUser, role: userRole });

        if (!hasTabAccess(userRole, activeTab)) {
          if (hasTabAccess(userRole, 'orders')) setActiveTab('orders');
          else if (hasTabAccess(userRole, 'products')) setActiveTab('products');
          else setActiveTab('dashboard');
        }
      } catch (e) {
        setUser(null);
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: loginEmail,
        password: loginPassword
      });

      const resData = response.data || {};
      const token = resData.token || 'mock_token_123';
      const userData = resData.user || resData;
      
      const actualRole = determineRole(loginEmail, userData.role || resData.role);

      const loggedUser = {
        _id: userData._id || userData.id || 'admin_id_123',
        name: userData.name || 'Admin User',
        email: loginEmail,
        role: actualRole
      };

      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');

      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(loggedUser));
      
      setUser(loggedUser);

      if (hasTabAccess(loggedUser.role, 'dashboard')) {
        setActiveTab('dashboard');
      } else if (hasTabAccess(loggedUser.role, 'products')) {
        setActiveTab('products');
      } else {
        setActiveTab('orders');
      }

      alert(`Welcome back, ${loggedUser.name}! Role: ${loggedUser.role}`);
      window.location.reload();
    } catch (error) {
      console.error('Login Error:', error);
      alert('Login Failed: ' + (error.response?.data?.message || 'Invalid Email or Password!'));
    }
  };

  const handleOpenSignup = () => {
    const enteredCode = prompt("🔒 Enter Admin Security Secret Code to Access Signup:");
    if (enteredCode === null) return;

    if (enteredCode.trim() === 'iamthebest~$@%^&15121') {
      setEditingAdminUser(null);
      setAdminFormData({ name: '', email: '', password: '', role: 'SuperAdmin', mobile: '' });
      setShowAddAdminModal(true);
    } else {
      alert("❌ Access Denied: Incorrect Secret Code!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    setUser(null);
    window.location.reload();
  };

  const fetchData = async () => {
    try {
      const authConfig = getAuthHeader();

      const prodRes = await axios.get(`${BASE_URL}/api/products`, authConfig);
      const fetchedProducts = prodRes.data.products || prodRes.data;
      const sortedProducts = Array.isArray(fetchedProducts) 
        ? fetchedProducts.sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100))
        : [];
      setProducts(sortedProducts);

      // Fetch Nested Categories Tree
      try {
        const catRes = await axios.get(`${BASE_URL}/api/categories`, authConfig);
        if (catRes.data && catRes.data.tree) {
          setCategoryTree(catRes.data.tree);
          setRawCategoriesList(catRes.data.categories || []);
        }
      } catch (catErr) {
        console.warn("Categories fetch fallback");
      }

      const orderRes = await axios.get(`${BASE_URL}/api/orders`, authConfig);
      const fetchedOrders = Array.isArray(orderRes.data) ? orderRes.data : (orderRes.data.orders || []);
      
      const sanitizedOrders = fetchedOrders.map((ord, idx) => ({
        ...ord,
        _id: ord._id || ord.id || ord.orderId || `LOCAL_ID_${idx}`
      }));
      setOrders(sanitizedOrders);

      const bannerRes = await axios.get(`${BASE_URL}/api/banners`, authConfig);
      setBanners(Array.isArray(bannerRes.data) ? bannerRes.data : []);

      const revRes = await axios.get(`${BASE_URL}/api/reviews`, authConfig);
      setReviews(Array.isArray(revRes.data) ? revRes.data : []);

      const couponRes = await axios.get(`${BASE_URL}/api/coupons`, authConfig);
      if (Array.isArray(couponRes.data)) {
        setCoupons(couponRes.data);
      }

      try {
        const custRes = await axios.get(`${BASE_URL}/api/auth/customers`, authConfig);
        if (Array.isArray(custRes.data)) {
          setCustomersList(custRes.data);
        }
      } catch (e) {
        console.log("Customer fetch fallback");
      }

      try {
        const adminRes = await axios.get(`${BASE_URL}/api/auth/admin-users`, authConfig);
        if (Array.isArray(adminRes.data)) {
          setAdminUsersList(adminRes.data);
        }
      } catch (e) {
        console.log("Admin users fetch fallback");
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 4000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // 🟢 CREATE NESTED SUB-CATEGORY
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newNestedCategoryName.trim()) return alert("Category Name is required!");

    try {
      const res = await axios.post(`${BASE_URL}/api/categories`, {
        name: newNestedCategoryName.trim(),
        parentId: selectedParentCategory || null
      }, getAuthHeader());

      alert(`🎉 Category '${newNestedCategoryName}' Created Successfully!`);
      setCategoryTree(res.data.tree || []);
      setNewNestedCategoryName('');
      setSelectedParentCategory('');
      fetchData();
    } catch (err) {
      alert("Failed to create category: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (window.confirm("⚠️ Delete this category and all its nested sub-categories?")) {
      try {
        const res = await axios.delete(`${BASE_URL}/api/categories/${catId}`, getAuthHeader());
        setCategoryTree(res.data.tree || []);
        fetchData();
      } catch (err) {
        alert("Failed to delete category: " + err.message);
      }
    }
  };

  const handleSaveAdminUser = async (e) => {
    e.preventDefault();
    try {
      const authConfig = getAuthHeader();
      if (editingAdminUser) {
        const res = await axios.put(`${BASE_URL}/api/auth/admin-users/${editingAdminUser._id || editingAdminUser.id}`, adminFormData, authConfig);
        alert('✅ Admin/Staff user updated successfully!');
        setAdminUsersList(res.data.admins || []);
      } else {
        const res = await axios.post(`${BASE_URL}/api/auth/admin-users`, adminFormData);
        alert('🎉 New Admin/Staff user created successfully! Please login now.');
        setAdminUsersList(res.data.admins || []);
      }
      setShowAddAdminModal(false);
      setEditingAdminUser(null);
      setAdminFormData({ name: '', email: '', password: '', role: 'Admin', mobile: '' });
      fetchData();
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteAdminUser = async (id) => {
    if (window.confirm('⚠️ Are you sure you want to delete this admin/staff user?')) {
      try {
        const authConfig = getAuthHeader();
        const res = await axios.delete(`${BASE_URL}/api/auth/admin-users/${id}`, authConfig);
        alert('🗑️ Admin/Staff user deleted successfully!');
        setAdminUsersList(res.data.admins || []);
      } catch (err) {
        alert('Delete failed: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  const totalOrdersCount = orders.length;
  const returnRequestsCount = orders.filter(o => o.status && o.status.includes('Return')).length;

  const filteredOrders = orders.filter(o => {
    const currentStatus = o.status || 'Processing';
    let statusMatch = true;

    if (orderStatusFilter === 'Delivered') {
      statusMatch = currentStatus === 'Delivered';
    } else if (orderStatusFilter === 'In Transit') {
      statusMatch = currentStatus === 'In Transit' || currentStatus === 'Shipped' || currentStatus === 'Out for Delivery';
    } else if (orderStatusFilter === 'Return') {
      statusMatch = currentStatus.includes('Return');
    } else if (orderStatusFilter === 'Refund') {
      statusMatch = currentStatus.includes('Refund');
    } else if (orderStatusFilter === 'Cancelled') {
      statusMatch = currentStatus === 'Cancelled';
    } else if (orderStatusFilter === 'Pending') {
      statusMatch = currentStatus === 'Pending' || currentStatus === 'Processing';
    }

    let searchMatch = true;
    if (orderSearchTerm.trim()) {
      const cleanTerm = orderSearchTerm.trim().toLowerCase();
      const orderIdMatch = (o._id || '').toLowerCase().includes(cleanTerm);
      const nameMatch = (o.shippingAddress?.name || '').toLowerCase().includes(cleanTerm);
      const emailMatch = (o.userEmail || '').toLowerCase().includes(cleanTerm);
      searchMatch = orderIdMatch || nameMatch || emailMatch;
    }

    return statusMatch && searchMatch;
  });

  const filteredCustomers = customersList.filter(cust => {
    if (customerFilter === 'CART') {
      return cust.cart && cust.cart.length > 0;
    }
    if (customerFilter === 'WISHLIST') {
      return cust.wishlist && cust.wishlist.length > 0;
    }
    return true;
  });

  const chartData = [
    { name: 'Mon', Revenue: 4000, Orders: 4 },
    { name: 'Tue', Revenue: 3000, Orders: 3 },
    { name: 'Wed', Revenue: 2000, Orders: 2 },
    { name: 'Thu', Revenue: 2780, Orders: 5 },
    { name: 'Fri', Revenue: 1890, Orders: 2 },
    { name: 'Sat', Revenue: 6390, Orders: 9 },
    { name: 'Sun', Revenue: 3490, Orders: 4 },
  ];

  // 🟢 COMPRESS & UPLOAD MULTIPLE IMAGES
  const handleMultipleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large (>5MB).`);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          const scale = MAX_WIDTH / img.width;
          
          canvas.width = scale < 1 ? MAX_WIDTH : img.width;
          canvas.height = scale < 1 ? img.height * scale : img.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          setImages((prev) => [...prev, compressedBase64]);
          if (!image) setImage(compressedBase64);
        };
      };
    });
  };

  const handleAddImageUrl = () => {
    if (!newImageUrlInput.trim()) return;
    const url = newImageUrlInput.trim();
    setImages((prev) => [...prev, url]);
    if (!image) setImage(url);
    setNewImageUrlInput('');
  };

  const handleRemoveImage = (indexToRemove) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    setImages(updated);
    if (updated.length > 0) {
      setImage(updated[0]);
    } else {
      setImage('');
    }
  };

  // 🟢 DYNAMIC ATTRIBUTE NAMES HANDLER (e.g. Size, Capacity, Weight, Speed)
  const handleAddAttributeName = () => {
    if (!newAttributeNameInput.trim()) return;
    const cleanName = newAttributeNameInput.trim();
    if (!dynamicAttributeNames.includes(cleanName)) {
      setDynamicAttributeNames([...dynamicAttributeNames, cleanName]);
    }
    setNewAttributeNameInput('');
  };

  const handleRemoveAttributeName = (attrName) => {
    setDynamicAttributeNames(dynamicAttributeNames.filter(a => a !== attrName));
  };

  // 🟢 ADD DYNAMIC VARIANT OPTION (WITH AUTO-SYNC FOR BASE PRICE & TOTAL STOCK)
  const handleAddDynamicVariant = () => {
    const parsedPrice = Number(variantPrice);
    const parsedStock = Number(variantStock);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert("⚠️ Please enter a valid Price (₹) for this variant option!");
      return;
    }

    const currentAttrs = {};
    dynamicAttributeNames.forEach(attr => {
      currentAttrs[attr] = (variantInputs[attr] || 'Standard').trim();
    });

    const newOption = {
      attributes: currentAttrs,
      color: currentAttrs['Color'] || currentAttrs['color'] || '',
      size: currentAttrs['Size'] || currentAttrs['size'] || '',
      price: parsedPrice,
      stock: isNaN(parsedStock) ? 0 : parsedStock
    };

    const updatedVariants = [...variants, newOption];
    setVariants(updatedVariants);

    // ⚡ AUTO-SYNC: Base Price becomes minimum variant price & Base Stock becomes sum of stocks
    const minPrice = Math.min(...updatedVariants.map(v => v.price));
    const totalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
    setPrice(minPrice);
    setStock(totalStock);

    setVariantPrice('');
    setVariantStock('');
  };

  const handleRemoveVariant = (indexToRemove) => {
    const updated = variants.filter((_, idx) => idx !== indexToRemove);
    setVariants(updated);
    if (updated.length > 0) {
      setPrice(Math.min(...updated.map(v => v.price)));
      setStock(updated.reduce((sum, v) => sum + v.stock, 0));
    }
  };

  const handleImageFileUpload = (e, targetSetter) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large! Please upload an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const scale = MAX_WIDTH / img.width;
        
        canvas.width = scale < 1 ? MAX_WIDTH : img.width;
        canvas.height = scale < 1 ? img.height * scale : img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        targetSetter(compressedBase64);
        alert('📸 Image processed and ready!');
      };
    };
  };

  // 🟢 ADD / SAVE BANNER WITH PRIORITY
  const handleAddBanner = async (e) => {
    e.preventDefault();
    if (!bannerTitle || !bannerImage) return alert('Title and Image are required!');

    try {
      const res = await axios.post(`${BASE_URL}/api/banners`, {
        title: bannerTitle,
        subtitle: bannerSubtitle,
        badge: bannerBadge,
        img: bannerImage,
        bg: bannerBg,
        priority: Number(bannerPriority) || 1
      }, getAuthHeader());

      alert(`🎉 New Hero Banner (Rank #${bannerPriority}) Published to Customer Site!`);
      setBanners(res.data.banners || []);
      setBannerTitle('');
      setBannerSubtitle('');
      setBannerBadge('');
      setBannerImage('');
      setBannerPriority(1);
    } catch (err) {
      alert('Failed to publish banner: ' + (err.response?.data?.message || err.message));
    }
  };

  // 🟢 QUICK UPDATE BANNER PRIORITY
  const handleUpdateBannerPriority = async (b, newRank) => {
    const rankNum = Number(newRank);
    if (isNaN(rankNum) || rankNum < 1) return;

    try {
      const res = await axios.put(`${BASE_URL}/api/banners/${b._id || b.id}`, {
        priority: rankNum
      }, getAuthHeader());

      setBanners(res.data.banners || []);
      fetchData();
    } catch (err) {
      alert('Failed to update banner priority: ' + err.message);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (window.confirm('Delete this banner slide?')) {
      try {
        const res = await axios.delete(`${BASE_URL}/api/banners/${id}`, getAuthHeader());
        setBanners(res.data.banners || []);
      } catch (err) {
        alert('Delete failed: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleCsvUpload = (e) => {
    e.preventDefault();
    if (!csvFile) return alert('Please select a CSV file first!');

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/^\ufeff/, ''),
      complete: async (results) => {
        const rows = results.data;
        if (!rows || rows.length === 0) {
          return alert('CSV file is empty or missing data rows!');
        }

        const authConfig = getAuthHeader();

        try {
          const uploadPromises = rows.map((row) => {
            const cleanRow = {};
            Object.keys(row).forEach((k) => {
              cleanRow[k.trim().toLowerCase()] = row[k];
            });

            const rawName = cleanRow.name || cleanRow.title || 'Imported Item';
            const rawPrice = parseCleanStock(cleanRow.price);
            const rawCategory = cleanRow.category || 'General';
            
            const rawDesc = (cleanRow.description && String(cleanRow.description).trim().length > 0) 
              ? String(cleanRow.description).trim() 
              : `High quality verified ${rawCategory} product.`;

            const rawImage = cleanRow.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';
            const rawImages = cleanRow.images ? cleanRow.images.split('|') : [rawImage];
            const rawStock = parseCleanStock(cleanRow.stock || cleanRow.countinstock || cleanRow.quantity || cleanRow.qty);
            const rawPriority = cleanRow.priority ? Number(cleanRow.priority) : 100;

            const productPayload = {
              name: String(rawName).trim(),
              price: rawPrice || 999,
              category: String(rawCategory).trim(),
              categoryPath: [String(rawCategory).trim()],
              description: rawDesc,
              image: String(rawImage).trim(),
              images: rawImages,
              variants: [],
              stock: rawStock,
              countInStock: rawStock,
              priority: rawPriority
            };

            return axios.post(`${BASE_URL}/api/products`, productPayload, authConfig);
          });

          await Promise.all(uploadPromises);
          alert(`🎉 Successfully uploaded ${rows.length} products to MongoDB!`);
          setCsvFile(null);
          fetchData();
        } catch (error) {
          console.error('CSV Import Error:', error);
          alert('Upload Error: ' + (error.response?.data?.message || error.message));
        }
      },
      error: (err) => {
        alert('Error parsing CSV file: ' + err.message);
      }
    });
  };

  const handleBulkDeleteProducts = async (deleteAll = false) => {
    const targets = deleteAll ? products.map(p => p._id || p.id) : selectedProductIds;
    
    if (targets.length === 0) return alert("No products selected to delete!");

    const confirmMsg = deleteAll 
      ? `🔥 ARE YOU SURE? This will delete ALL ${targets.length} products from database!`
      : `Delete ${targets.length} selected products?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const authConfig = getAuthHeader();
      await Promise.all(
        targets.map(id => axios.delete(`${BASE_URL}/api/products/${id}`, authConfig))
      );
      
      alert(`🎉 Successfully wiped ${targets.length} products from Database!`);
      setSelectedProductIds([]);
      fetchData();
    } catch (error) {
      alert('Deletion Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleSelectAllProducts = (e) => {
    if (e.target.checked) {
      setSelectedProductIds(products.map(p => p._id || p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectProduct = (id) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(item => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  // 🟢 SAVE PRODUCT (SMART PRICE/STOCK CALCULATION & FULL SYNC)
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    
    let finalPrice = Number(price) || 0;
    let finalStock = Number(stock) || 0;

    if (variants.length > 0) {
      finalPrice = Math.min(...variants.map(v => v.price));
      finalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    }

    const finalImagesList = images.length > 0 ? images : (image ? [image] : []);
    const finalCoverImage = finalImagesList.length > 0 ? finalImagesList[0] : (image || '');
    const primaryCategory = selectedCategoryPath[selectedCategoryPath.length - 1] || 'General';

    const productData = { 
      name, 
      price: finalPrice, 
      category: primaryCategory,
      categoryPath: selectedCategoryPath,
      description: description || 'High quality store product.', 
      image: finalCoverImage,
      images: finalImagesList,
      dynamicAttributeNames,
      variants: variants || [],
      stock: finalStock,
      countInStock: finalStock,
      priority: Number(productPriority) || 100
    };

    try {
      if (editingId) {
        await axios.put(`${BASE_URL}/api/products/${editingId}`, productData, getAuthHeader());
        alert(`✅ Product '${name}' Updated!`);
      } else {
        await axios.post(`${BASE_URL}/api/products`, productData, getAuthHeader());
        alert(`🎉 New Product Created!`);
      }
      resetProductForm();
      fetchData();
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.message || error.message));
    }
  };

  // 🟢 1-CLICK SAVE PRODUCT RANK DIRECTLY TO MONGODB
  const handleSaveSingleProductRank = async (prod, rankValue) => {
    const targetId = prod._id || prod.id;
    const numRank = parseInt(rankValue, 10);
    
    if (isNaN(numRank) || numRank < 1) {
      alert("⚠️ Please enter a valid rank number (e.g. 1, 2, 3...)");
      return;
    }

    try {
      const authConfig = getAuthHeader();
      
      let res;
      try {
        res = await axios.put(`${BASE_URL}/api/products/${targetId}/priority`, { priority: numRank }, authConfig);
      } catch (e) {
        res = await axios.put(`${BASE_URL}/api/products/${targetId}`, { priority: numRank }, authConfig);
      }

      if (res.status === 200) {
        setProducts(prevProducts => {
          const updated = prevProducts.map(p => 
            (p._id === targetId || p.id === targetId) ? { ...p, priority: numRank } : p
          );
          return updated.sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100));
        });

        setRankInputs(prev => ({ ...prev, [targetId]: numRank }));
        alert(`✅ Display Rank #${numRank} assigned successfully to '${prod.name}'!`);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update rank:', err);
      alert('Failed to save rank: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditProduct = (p) => {
    const targetId = p._id || p.id;
    setEditingId(targetId);
    setName(p.name);
    setPrice(p.price);
    setSelectedCategoryPath(Array.isArray(p.categoryPath) && p.categoryPath.length > 0 ? p.categoryPath : [p.category || 'General']);
    setDescription(p.description);
    
    const primaryImg = getCleanImageUrl(p.image);
    const galleryImgs = Array.isArray(p.images) && p.images.length > 0 
      ? p.images.map(getCleanImageUrl) 
      : (primaryImg ? [primaryImg] : []);

    setImage(primaryImg);
    setImages(galleryImgs);
    setDynamicAttributeNames(Array.isArray(p.dynamicAttributeNames) && p.dynamicAttributeNames.length > 0 ? p.dynamicAttributeNames : ['Size', 'Color']);
    setVariants(Array.isArray(p.variants) ? p.variants : []);
    setProductPriority(p.priority !== undefined ? Number(p.priority) : 100);
    
    const fetchedStock = p.countInStock !== undefined ? p.countInStock : (p.stock !== undefined ? p.stock : 0);
    setStock(Number(fetchedStock));
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Delete product permanently?')) {
      try {
        await axios.delete(`${BASE_URL}/api/products/${id}`, getAuthHeader());
        fetchData();
      } catch (error) {
        alert('Delete failed: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setSelectedCategoryPath(['General']);
    setDescription('');
    setImage('');
    setImages([]);
    setVariants([]);
    setVariantInputs({});
    setVariantPrice('');
    setVariantStock('');
    setNewImageUrlInput('');
    setStock(0);
    setProductPriority(100);
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    if (!orderId || orderId.startsWith('LOCAL_ID_')) {
      alert('⚠️ Yeh order purana local/dummy order hai jo Database mein registered nahi hai.');
      return;
    }
    
    try {
      await axios.put(`${BASE_URL}/api/orders/${orderId}`, { status: newStatus }, getAuthHeader());
      alert(`Order #${orderId} status updated to ${newStatus}`);
      fetchData();
    } catch (error) {
      alert('Status update failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCouponCode || !newCouponDiscount) return alert('Code and Discount are required!');

    const couponPayload = {
      code: newCouponCode.toUpperCase().trim(),
      discount: Number(newCouponDiscount),
      category: newCouponCategory || 'All',
      maxUsage: Number(newCouponMaxUsage) || 100,
      type: 'Percentage',
      status: 'Active'
    };

    try {
      const res = await axios.post(`${BASE_URL}/api/coupons`, couponPayload, getAuthHeader());
      alert(`🎉 Coupon '${couponPayload.code}' Published Live!`);
      if (res.data && res.data.coupons) {
        setCoupons(res.data.coupons);
      } else {
        fetchData();
      }
    } catch (err) {
      alert('Coupon error: ' + (err.response?.data?.message || err.message));
    }

    setNewCouponCode('');
    setNewCouponDiscount('');
    setNewCouponCategory('All');
    setNewCouponMaxUsage(50);
  };

  const handleCreatePersonalDiscount = async (e) => {
    e.preventDefault();
    if (!selectedTargetCustomer || !personalCouponCode || !personalCouponDiscount) {
      alert("Coupon Code and Discount % are required!");
      return;
    }

    const personalCouponPayload = {
      code: personalCouponCode.toUpperCase().trim(),
      discount: Number(personalCouponDiscount),
      category: 'All',
      maxUsage: 1,
      status: 'Active',
      targetUserEmail: selectedTargetCustomer.email.toLowerCase().trim()
    };

    try {
      await axios.post(`${BASE_URL}/api/coupons`, personalCouponPayload, getAuthHeader());
      alert(`🎁 Exclusive ${personalCouponDiscount}% Discount Coupon '${personalCouponPayload.code}' generated specifically for ${selectedTargetCustomer.name} (${selectedTargetCustomer.email})!`);
      setShowPersonalDiscountModal(false);
      setPersonalCouponCode('');
      fetchData();
    } catch (err) {
      alert('Failed to issue discount: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (window.confirm('Delete this coupon code?')) {
      try {
        const res = await axios.delete(`${BASE_URL}/api/coupons/${id}`, getAuthHeader());
        if (res.data && res.data.coupons) {
          setCoupons(res.data.coupons);
        } else {
          fetchData();
        }
      } catch (err) {
        alert('Delete coupon failed: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  // Helper to render nested category tree items recursively
  const renderCategoryTreeUI = (tree, depth = 0) => {
    return tree.map((node) => (
      <div key={node._id} style={{ marginLeft: `${depth * 20}px` }} className="border-start ps-2 my-1">
        <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
          <div>
            <span className="fw-bold text-dark">{depth > 0 ? '↳ ' : '📁 '}{node.name}</span>
          </div>
          <div className="d-flex gap-1">
            <button 
              className="btn btn-sm btn-outline-primary py-0 px-2"
              style={{ fontSize: '11px' }}
              onClick={() => {
                setSelectedParentCategory(node._id);
                alert(`Selected '${node.name}' as Parent Category. Now enter Sub-Category name!`);
              }}
            >
              + Sub
            </button>
            <button 
              className="btn btn-sm btn-outline-danger py-0 px-1"
              style={{ fontSize: '11px' }}
              onClick={() => handleDeleteCategory(node._id)}
            >
              ✕
            </button>
          </div>
        </div>
        {node.children && node.children.length > 0 && renderCategoryTreeUI(node.children, depth + 1)}
      </div>
    ));
  };

  if (!user) {
    return (
      <div className="bg-dark min-vh-100 d-flex align-items-center justify-content-center">
        <div className="card shadow-lg p-4 border-0" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center mb-4">
            <h3 className="fw-bold text-primary">TechStore Portal</h3>
            <p className="text-muted small">Admin & Staff Access Guard</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold">Email Address</label>
              <input type="email" className="form-control" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@techstore.com" />
            </div>
            <div className="mb-4">
              <label className="form-label fw-bold">Password</label>
              <input type="password" className="form-control" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary w-100 fw-bold py-2 mb-3">Login to Portal</button>
            <div className="text-center">
              <button type="button" className="btn btn-link text-decoration-none small" onClick={handleOpenSignup}>
                Don't have an account? <b>Sign Up here</b>
              </button>
            </div>
          </form>
        </div>

        {showAddAdminModal && (
          <div className="modal show d-block bg-dark bg-opacity-50" tabIndex="-1" style={{ zIndex: 1070 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg p-3 p-md-4 rounded-4">
                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                  <h5 className="fw-bold mb-0 text-primary">
                    {editingAdminUser ? '✏️ Edit Admin / Staff User' : '➕ Register New Admin / Staff'}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddAdminModal(false)}></button>
                </div>

                <form onSubmit={handleSaveAdminUser}>
                  <div className="mb-2">
                    <label className="form-label fw-bold small">Full Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required 
                      value={adminFormData.name} 
                      onChange={(e) => setAdminFormData({...adminFormData, name: e.target.value})} 
                      placeholder="John Manager"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label fw-bold small">Email ID</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      required 
                      value={adminFormData.email} 
                      onChange={(e) => setAdminFormData({...adminFormData, email: e.target.value})} 
                      placeholder="manager@techstore.com"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label fw-bold small">Password {editingAdminUser && '(Leave blank to keep old)'}</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      required={!editingAdminUser} 
                      value={adminFormData.password} 
                      onChange={(e) => setAdminFormData({...adminFormData, password: e.target.value})} 
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label fw-bold small">Role / Permission</label>
                    <select 
                      className="form-select fw-bold text-primary" 
                      value={adminFormData.role} 
                      onChange={(e) => setAdminFormData({...adminFormData, role: e.target.value})} 
                    >
                      <option value="SuperAdmin">SuperAdmin (Full Access)</option>
                      <option value="InventoryManager">InventoryManager (Products & Stock)</option>
                      <option value="Staff">Support Staff (Orders & Reviews)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold small">Mobile Number</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={adminFormData.mobile} 
                      onChange={(e) => setAdminFormData({...adminFormData, mobile: e.target.value})} 
                      placeholder="+91 9876543210"
                    />
                  </div>

                  <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddAdminModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary fw-bold px-4">Save Admin User</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const userRole = user.role || 'SuperAdmin';

  return (
    <div className="d-flex bg-light min-vh-100 position-relative">
      
      {/* TOP HEADER BAR */}
      <div 
        className="position-fixed top-0 start-0 w-100 d-flex justify-content-between align-items-center px-3 py-2 bg-dark shadow" 
        style={{ zIndex: 1050, height: '56px' }}
      >
        <button 
          className="btn btn-warning d-flex flex-column justify-content-center align-items-center p-2 shadow-sm rounded-2"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle Menu"
          style={{ width: '40px', height: '40px', cursor: 'pointer' }}
        >
          <span className="bg-dark mb-1" style={{ width: '22px', height: '3px', borderRadius: '2px' }}></span>
          <span className="bg-dark mb-1" style={{ width: '22px', height: '3px', borderRadius: '2px' }}></span>
          <span className="bg-dark" style={{ width: '22px', height: '3px', borderRadius: '2px' }}></span>
        </button>

        <span className="fw-bold text-warning d-none d-sm-inline fs-5">TechStore Admin</span>

        <div className="d-flex align-items-center gap-2">
          {/* 📲 1-CLICK INSTALL ADMIN APP BUTTON */}
          {installPrompt && !isRunningStandalone() && (
            <button 
              className="btn btn-outline-warning btn-sm fw-bold rounded-pill shadow-sm d-flex align-items-center gap-1"
              onClick={handleInstallAdminApp}
            >
              <i className="bi bi-download"></i>
              <span>Install App</span>
            </button>
          )}

          <button 
            className="btn btn-danger btn-sm fw-bold px-3 py-1 rounded-pill shadow-sm d-flex align-items-center"
            onClick={handleLogout}
          >
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* SIDEBAR NAVIGATION DRAWER */}
      {sidebarOpen && (
        <div 
          className="bg-dark text-white p-3 d-flex flex-column position-fixed top-0 start-0 z-3 shadow-lg" 
          style={{ width: '260px', minHeight: '100vh', transition: '0.3s', zIndex: 1060 }}
        >
          <div className="d-flex align-items-center justify-content-between pt-2 mb-1">
            <h4 className="text-warning fw-bold m-0 fs-5">
              <i className="bi bi-speedometer2 me-2"></i>TechStore Admin
            </h4>
            <button className="btn-close btn-close-white" onClick={() => setSidebarOpen(false)}></button>
          </div>
          
          <div className="mb-3 px-1">
            <small className="text-muted d-block">{user.name || 'Admin User'}</small>
            <span className="badge bg-info text-dark">{userRole}</span>
          </div>

          <div className="nav flex-column nav-pills gap-2">
            {hasTabAccess(userRole, 'dashboard') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'dashboard' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('dashboard')}
              >
                <i className="bi bi-graph-up-arrow me-2"></i>Analytics Dashboard
              </button>
            )}

            {hasTabAccess(userRole, 'categories-tree') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'categories-tree' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('categories-tree')}
              >
                <i className="bi bi-diagram-3-fill me-2"></i>🌳 Infinite Categories Tree
              </button>
            )}

            {hasTabAccess(userRole, 'banners') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'banners' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('banners')}
              >
                <i className="bi bi-images me-2"></i>🎨 Sliding Banners (Priority)
              </button>
            )}

            {hasTabAccess(userRole, 'products') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'products' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('products')}
              >
                <i className="bi bi-box-seam me-2"></i>Products & Dynamic Variants (PIM)
              </button>
            )}

            {hasTabAccess(userRole, 'orders') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'orders' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('orders')}
              >
                <i className="bi bi-receipt me-2"></i>Orders & Shipping
              </button>
            )}

            {hasTabAccess(userRole, 'returns') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'returns' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('returns')}
              >
                <i className="bi bi-arrow-counterclockwise me-2"></i>🔄 Return Requests ({returnRequestsCount})
              </button>
            )}

            {hasTabAccess(userRole, 'reviews') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'reviews' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('reviews')}
              >
                <i className="bi bi-star-fill me-2"></i>⭐ Customer Reviews ({reviews.length})
              </button>
            )}

            {hasTabAccess(userRole, 'coupons') && (
              <button 
                className={`nav-link text-start fw-bold ${activeTab === 'coupons' ? 'active bg-warning text-dark' : 'text-white'}`} 
                onClick={() => handleTabSelect('coupons')}
              >
                <i className="bi bi-ticket-perforated me-2"></i>Marketing & Coupons ({coupons.length})
              </button>
            )}

            <button 
              className={`nav-link text-start fw-bold ${activeTab === 'customers' ? 'active bg-warning text-dark' : 'text-white'}`} 
              onClick={() => handleTabSelect('customers')}
            >
              <i className="bi bi-people-fill me-2"></i>👥 Customers & Wishlist ({customersList.length})
            </button>

            <button 
              className={`nav-link text-start fw-bold ${activeTab === 'admin-users' ? 'active bg-warning text-dark' : 'text-white'}`} 
              onClick={() => handleTabSelect('admin-users')}
            >
              <i className="bi bi-shield-lock-fill me-2"></i>⚙️ Admin Users ({adminUsersList.length})
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow-1 p-3 p-md-4 overflow-auto" style={{ maxHeight: '100vh', marginTop: '56px' }}>
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && hasTabAccess(userRole, 'dashboard') && (
          <div>
            <h3 className="fw-bold mb-4">Enterprise Analytics Overview</h3>
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white border-start border-4 border-success">
                  <span className="text-muted small fw-bold">TOTAL REVENUE</span>
                  <h3 className="fw-bold text-success m-0">₹{totalRevenue.toLocaleString()}</h3>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white border-start border-4 border-primary">
                  <span className="text-muted small fw-bold">LIVE ORDERS</span>
                  <h3 className="fw-bold text-primary m-0">{totalOrdersCount}</h3>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white border-start border-4 border-warning">
                  <span className="text-muted small fw-bold">ACTIVE PRODUCTS</span>
                  <h3 className="fw-bold text-warning m-0">{products.length}</h3>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white border-start border-4 border-danger">
                  <span className="text-muted small fw-bold">RETURN REQUESTS</span>
                  <h3 className="fw-bold text-danger m-0">{returnRequestsCount}</h3>
                </div>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-md-8">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">Revenue & Sales Trends</h5>
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="Revenue" stroke="#198754" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">Daily Orders</h5>
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Orders" fill="#0d6efd" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🟢 🌳 INFINITE NESTED CATEGORIES TAB */}
        {activeTab === 'categories-tree' && (
          <div>
            <h3 className="fw-bold mb-4">🌳 Infinite Nested Category & Sub-Category Tree Manager</h3>
            <div className="row g-4">
              
              <div className="col-lg-5">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">➕ Add Category / Sub-Category Branch</h5>
                  <form onSubmit={handleCreateCategory}>
                    
                    <div className="mb-3">
                      <label className="form-label fw-bold small text-primary">Parent Category (Optional)</label>
                      <select 
                        className="form-select fw-semibold"
                        value={selectedParentCategory}
                        onChange={(e) => setSelectedParentCategory(e.target.value)}
                      >
                        <option value="">📁 Root / Main Category (No Parent)</option>
                        {rawCategoriesList.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            ↳ Sub-Category under: {cat.name}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                        * Leave as "Root" to create a main category (e.g. Computers, Fashion, Pets). Select a parent to create sub-category!
                      </small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold small">Category / Sub-Category Name</label>
                      <input 
                        type="text" 
                        className="form-control fw-bold" 
                        required 
                        placeholder="e.g. Storage Devices, Hard Disks, Dog Food"
                        value={newNestedCategoryName} 
                        onChange={(e) => setNewNestedCategoryName(e.target.value)} 
                      />
                    </div>

                    <button type="submit" className="btn btn-primary w-100 fw-bold py-2 shadow-sm">
                      + Create Category Branch
                    </button>
                  </form>
                </div>
              </div>

              <div className="col-lg-7">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold m-0">Live Nested Category Tree Hierarchy</h5>
                    <button className="btn btn-sm btn-outline-primary fw-bold" onClick={fetchData}>
                      Sync Tree
                    </button>
                  </div>

                  {categoryTree.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <h5>No categories created yet.</h5>
                      <p className="small">Use the form on left to create your first root category!</p>
                    </div>
                  ) : (
                    <div className="p-2 border rounded bg-white">
                      {renderCategoryTreeUI(categoryTree)}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 🟢 PRODUCTS & DYNAMIC VARIANTS TAB */}
        {activeTab === 'products' && hasTabAccess(userRole, 'products') && (
          <div>
            <h3 className="fw-bold mb-4">Product Information & Dynamic Attributes Pricing (PIM)</h3>

            {/* CSV BULK UPLOAD */}
            <div className="card border-0 shadow-sm p-4 bg-white mb-4">
              <h5 className="fw-bold mb-3 text-success">
                <i className="bi bi-file-earmark-spreadsheet me-2"></i>Bulk Product Upload (CSV)
              </h5>
              <form onSubmit={handleCsvUpload} className="d-flex gap-3 align-items-center">
                <input 
                  type="file" 
                  className="form-control" 
                  accept=".csv" 
                  onChange={(e) => setCsvFile(e.target.files[0])} 
                />
                <button type="submit" className="btn btn-success fw-bold text-nowrap">
                  <i className="bi bi-upload me-1"></i> Upload CSV
                </button>
              </form>
              <small className="text-muted mt-2 d-block">
                CSV Headers: <code>name, price, category, description, image, images (pipe | separated), stock, priority</code>
              </small>
            </div>

            <div className="row g-4">
              <div className="col-lg-5">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">{editingId ? '✏️ Edit Product' : '➕ Add New Product'}</h5>
                  <form onSubmit={handleProductSubmit}>
                    
                    <div className="mb-2">
                      <label className="form-label fw-semibold">Product Title</label>
                      <input type="text" className="form-control" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RTX 4070 Super" />
                    </div>

                    <div className="row mb-2">
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Base Price (₹) {variants.length > 0 && <span className="badge bg-info text-dark" style={{ fontSize: '9px' }}>Auto (Min)</span>}
                        </label>
                        <input 
                          type="number" 
                          className="form-control" 
                          required 
                          value={price} 
                          onChange={(e) => setPrice(e.target.value)} 
                          placeholder="e.g. 55000"
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Total Stock {variants.length > 0 && <span className="badge bg-info text-dark" style={{ fontSize: '9px' }}>Auto (Sum)</span>}
                        </label>
                        <input 
                          type="number" 
                          className="form-control" 
                          required 
                          value={stock} 
                          onChange={(e) => setStock(e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* 🟢 CATEGORY HIERARCHY SELECTOR */}
                    <div className="row mb-2">
                      <div className="col-6">
                        <label className="form-label fw-bold small text-primary">Category Branch</label>
                        <select 
                          className="form-select fw-bold"
                          value={selectedCategoryPath[selectedCategoryPath.length - 1] || 'General'}
                          onChange={(e) => setSelectedCategoryPath([e.target.value])}
                        >
                          <option value="General">General</option>
                          {rawCategoriesList.map((cat) => (
                            <option key={cat._id} value={cat.name}>
                              📁 {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-bold text-success">⭐ Display Rank</label>
                        <input 
                          type="number" 
                          className="form-control fw-bold border-success" 
                          min="1" 
                          placeholder="1 (Top Position)" 
                          value={productPriority} 
                          onChange={(e) => setProductPriority(e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* 📸 MULTIPLE GALLERY IMAGES SECTION */}
                    <div className="mb-3 p-3 bg-light rounded border">
                      <label className="form-label fw-bold text-primary d-flex align-items-center justify-content-between m-0 mb-2">
                        <span>📸 Product Images (Front, Back, Sides)</span>
                        <span className="badge bg-primary">{images.length} Added</span>
                      </label>
                      
                      <div className="input-group input-group-sm mb-2">
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Paste image URL (https://...)" 
                          value={newImageUrlInput} 
                          onChange={(e) => setNewImageUrlInput(e.target.value)} 
                        />
                        <button type="button" className="btn btn-primary fw-bold" onClick={handleAddImageUrl}>+ Add URL</button>
                      </div>

                      <div className="text-center my-1 text-muted small fw-bold">-- OR UPLOAD FROM DEVICE --</div>
                      
                      <input 
                        type="file" 
                        className="form-control form-control-sm mb-2" 
                        accept="image/*" 
                        multiple 
                        onChange={handleMultipleImageUpload} 
                      />

                      {images.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2 pt-2 border-top">
                          {images.map((imgUrl, idx) => (
                            <div key={idx} className="position-relative border rounded p-1 bg-white shadow-sm" style={{ width: '60px', height: '60px' }}>
                              <img 
                                src={getCleanImageUrl(imgUrl)} 
                                alt={`Angle ${idx + 1}`} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} 
                              />
                              {idx === 0 && (
                                <span className="position-absolute bottom-0 start-0 badge bg-dark text-warning" style={{ fontSize: '8px', transform: 'scale(0.8)' }}>
                                  Cover
                                </span>
                              )}
                              <button 
                                type="button" 
                                className="position-absolute top-0 end-0 btn btn-danger btn-sm p-0 rounded-circle d-flex align-items-center justify-content-center"
                                style={{ width: '18px', height: '18px', fontSize: '10px', transform: 'translate(30%, -30%)' }}
                                onClick={() => handleRemoveImage(idx)}
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 🟢 100% DYNAMIC ATTRIBUTES & CUSTOM VARIANT PRICING */}
                    <div className="mb-3 p-3 bg-light rounded border border-primary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label fw-bold text-primary m-0">
                          ⚙️ Define Parameters / Variables for this Product:
                        </label>
                      </div>

                      <div className="input-group input-group-sm mb-2">
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Type Parameter Name (e.g. Capacity, Speed, Weight, Size)"
                          value={newAttributeNameInput} 
                          onChange={(e) => setNewAttributeNameInput(e.target.value)} 
                        />
                        <button type="button" className="btn btn-primary fw-bold" onClick={handleAddAttributeName}>
                          + Add Variable
                        </button>
                      </div>

                      <div className="d-flex flex-wrap gap-1 mb-3">
                        {dynamicAttributeNames.map((attr, idx) => (
                          <span key={idx} className="badge bg-secondary p-2 d-inline-flex align-items-center gap-1">
                            <span>{attr}</span>
                            <span style={{ cursor: 'pointer' }} onClick={() => handleRemoveAttributeName(attr)}>✕</span>
                          </span>
                        ))}
                      </div>

                      <div className="p-2 border rounded bg-white mb-2">
                        <span className="small fw-bold text-dark d-block mb-1">Enter Option Value & Price:</span>
                        <div className="row g-2 mb-2">
                          {dynamicAttributeNames.map((attr, idx) => (
                            <div key={idx} className="col-6">
                              <label className="small text-muted fw-bold">{attr}:</label>
                              <input 
                                type="text" 
                                className="form-control form-control-sm fw-bold" 
                                placeholder={`e.g. ${attr === 'Size' ? 'XL' : attr === 'Capacity' ? '12GB' : 'Val'}`}
                                value={variantInputs[attr] || ''} 
                                onChange={(e) => setVariantInputs({ ...variantInputs, [attr]: e.target.value })} 
                              />
                            </div>
                          ))}
                          <div className="col-6">
                            <label className="small text-muted fw-bold">Price (₹):</label>
                            <input 
                              type="number" 
                              className="form-control form-control-sm fw-bold text-success" 
                              placeholder="Price ₹"
                              value={variantPrice} 
                              onChange={(e) => setVariantPrice(e.target.value)} 
                            />
                          </div>
                          <div className="col-6">
                            <label className="small text-muted fw-bold">Stock:</label>
                            <input 
                              type="number" 
                              className="form-control form-control-sm" 
                              placeholder="Stock"
                              value={variantStock} 
                              onChange={(e) => setVariantStock(e.target.value)} 
                            />
                          </div>
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-primary fw-bold w-100 py-1"
                          onClick={handleAddDynamicVariant}
                        >
                          + Add This Combination
                        </button>
                      </div>

                      {variants.length > 0 && (
                        <div className="table-responsive border rounded bg-white">
                          <table className="table table-sm table-bordered m-0 align-middle">
                            <thead className="table-secondary text-nowrap">
                              <tr>
                                <th>Configured Attributes</th>
                                <th>Price (₹)</th>
                                <th>Stock</th>
                                <th className="text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {variants.map((v, idx) => {
                                const attrDisplay = Object.entries(v.attributes || {})
                                  .map(([k, val]) => `${k}: ${val}`)
                                  .join(' | ') || (v.size ? `Size: ${v.size}` : 'Standard');

                                return (
                                  <tr key={idx}>
                                    <td className="small fw-bold">{attrDisplay}</td>
                                    <td className="text-success fw-bold">₹{v.price}</td>
                                    <td>{v.stock}</td>
                                    <td className="text-center">
                                      <button 
                                        type="button" 
                                        className="btn btn-sm btn-danger py-0 px-2"
                                        style={{ fontSize: '11px' }}
                                        onClick={() => handleRemoveVariant(idx)}
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Description</label>
                      <textarea className="form-control" rows="2" required value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
                    </div>
                    
                    <div className="d-flex gap-2">
                      <button type="submit" className="btn btn-primary w-100 fw-bold">{editingId ? 'Save Product' : 'Create Product'}</button>
                      {editingId && <button type="button" className="btn btn-secondary" onClick={resetProductForm}>Cancel</button>}
                    </div>
                  </form>
                </div>
              </div>

              {/* PRODUCTS LIST TABLE */}
              <div className="col-lg-7">
                <div className="card border-0 shadow-sm p-3 bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <h5 className="fw-bold m-0">Live Inventory Management ({products.length})</h5>
                    
                    {userRole === 'SuperAdmin' && (
                      <div className="d-flex gap-2">
                        {selectedProductIds.length > 0 && (
                          <button 
                            className="btn btn-warning btn-sm fw-bold shadow-sm"
                            onClick={() => handleBulkDeleteProducts(false)}
                          >
                            🗑️ Delete Selected ({selectedProductIds.length})
                          </button>
                        )}
                        {products.length > 0 && (
                          <button 
                            className="btn btn-danger btn-sm fw-bold shadow-sm"
                            onClick={() => handleBulkDeleteProducts(true)}
                          >
                            🔥 Clear ALL Products
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle border m-0">
                      <thead className="table-dark">
                        <tr>
                          {userRole === 'SuperAdmin' && (
                            <th style={{ width: '40px', minWidth: '40px', whiteSpace: 'nowrap' }}>
                              <input 
                                type="checkbox" 
                                className="form-check-input" 
                                checked={products.length > 0 && selectedProductIds.length === products.length} 
                                onChange={handleSelectAllProducts} 
                              />
                            </th>
                          )}
                          <th style={{ minWidth: '170px', whiteSpace: 'nowrap' }}>⭐ Set Rank</th>
                          <th style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>Product Item</th>
                          <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Category</th>
                          <th style={{ minWidth: '90px', whiteSpace: 'nowrap' }}>Base Price</th>
                          <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Stock</th>
                          <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={userRole === 'SuperAdmin' ? 7 : 6} className="text-center py-4 text-muted">
                              No products found in database.
                            </td>
                          </tr>
                        ) : (
                          products.map((p) => {
                            const targetId = p._id || p.id;
                            const rawVal = p.countInStock !== undefined ? p.countInStock : (p.stock !== undefined ? p.stock : 0);
                            const currentStock = Number(rawVal) || 0;
                            const isSelected = selectedProductIds.includes(targetId);
                            const defaultRank = p.priority !== undefined ? p.priority : 100;
                            const currentInputRank = rankInputs[targetId] !== undefined ? rankInputs[targetId] : defaultRank;
                            const totalImgs = Array.isArray(p.images) && p.images.length > 0 ? p.images.length : (p.image ? 1 : 0);
                            const totalVariants = Array.isArray(p.variants) ? p.variants.length : 0;

                            return (
                            <tr key={targetId} className={isSelected ? 'table-warning' : ''}>
                              {userRole === 'SuperAdmin' && (
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <input 
                                    type="checkbox" 
                                    className="form-check-input" 
                                    checked={isSelected} 
                                    onChange={() => handleToggleSelectProduct(targetId)} 
                                  />
                                </td>
                              )}
                              
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div className="d-flex align-items-center gap-1">
                                  <input 
                                    type="number" 
                                    className="form-control form-control-sm fw-bold border-success text-center" 
                                    style={{ width: '65px' }} 
                                    min="1"
                                    value={currentInputRank} 
                                    onChange={(e) => setRankInputs({ ...rankInputs, [targetId]: e.target.value })}
                                  />
                                  <button 
                                    type="button"
                                    className="btn btn-sm btn-success fw-bold px-2 py-1 shadow-sm d-flex align-items-center gap-1"
                                    style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                                    onClick={() => handleSaveSingleProductRank(p, currentInputRank)}
                                  >
                                    <span>💾 Save</span>
                                  </button>
                                </div>
                              </td>

                              <td className="fw-bold small" style={{ whiteSpace: 'nowrap' }}>
                                <div className="d-flex align-items-center gap-2">
                                  <img 
                                    src={getCleanImageUrl(p.image) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100'} 
                                    alt={p.name} 
                                    width="36" 
                                    height="36" 
                                    className="rounded border" 
                                    style={{ objectFit: 'cover' }} 
                                  />
                                  <div>
                                    <span>{p.name}</span>
                                    <div className="d-flex gap-1 mt-1">
                                      <span className="badge bg-secondary" style={{ fontSize: '9px' }}>
                                        📸 {totalImgs} Photos
                                      </span>
                                      {totalVariants > 0 && (
                                        <span className="badge bg-primary" style={{ fontSize: '9px' }}>
                                          ⚙️ {totalVariants} Options
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}><span className="badge bg-secondary">{p.category}</span></td>
                              <td className="text-success fw-bold" style={{ whiteSpace: 'nowrap' }}>₹{p.price}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {currentStock <= 0 ? (
                                  <span className="badge bg-danger">Out of Stock (0)</span>
                                ) : currentStock < 5 ? (
                                  <span className="badge bg-warning text-dark">Low ({currentStock})</span>
                                ) : (
                                  <span className="badge bg-success">In Stock ({currentStock})</span>
                                )}
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div className="btn-group btn-group-sm">
                                  <button className="btn btn-outline-primary" onClick={() => handleEditProduct(p)}>Edit</button>
                                  {userRole === 'SuperAdmin' && (
                                    <button className="btn btn-outline-danger" onClick={() => handleDeleteProduct(targetId)}>Delete</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )})
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS & SHIPPING TAB */}
        {activeTab === 'orders' && hasTabAccess(userRole, 'orders') && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <h3 className="fw-bold m-0">Live Customer Orders & Logistics</h3>
              
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <select 
                  className="form-select form-select-sm fw-bold border-success text-dark"
                  style={{ width: '220px' }}
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <option value="ALL">🌟 All Order Statuses</option>
                  <option value="Delivered">✅ Delivered Only</option>
                  <option value="In Transit">🚚 In Transit / Shipped</option>
                  <option value="Return">🔄 Return / Replacement Requests</option>
                  <option value="Refund">💵 Refund Processed</option>
                  <option value="Cancelled">❌ Cancelled Only</option>
                  <option value="Pending">⏳ Pending / Processing</option>
                </select>

                <div className="input-group input-group-sm" style={{ width: '280px' }}>
                  <input 
                    type="text" 
                    className="form-control fw-bold border-primary" 
                    placeholder="Search Order ID or Customer..." 
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                  />
                  {orderSearchTerm && (
                    <button className="btn btn-outline-secondary" onClick={() => setOrderSearchTerm('')}>
                      X
                    </button>
                  )}
                </div>

                <button className="btn btn-outline-primary btn-sm fw-bold" onClick={fetchData}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Sync Live Orders
                </button>
              </div>
            </div>

            <div className="card border-0 shadow-sm p-3 bg-white">
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle m-0">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Order ID</th>
                      <th style={{ minWidth: '200px', whiteSpace: 'nowrap' }}>Customer Name</th>
                      <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Total Price</th>
                      <th style={{ minWidth: '200px', whiteSpace: 'nowrap' }}>Payment Method</th>
                      <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Current Status</th>
                      <th style={{ minWidth: '250px', whiteSpace: 'nowrap' }}>Update Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-5 text-muted">
                          <i className="bi bi-search fs-2 d-block mb-2 text-secondary"></i>
                          <h5>No orders found matching your selected filter.</h5>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o, idx) => {
                        const orderId = o._id || o.id || o.orderId || null;

                        return (
                        <tr key={orderId || idx}>
                          <td className="fw-bold text-primary" style={{ whiteSpace: 'nowrap' }}>#{orderId ? orderId : 'N/A'}</td>
                          <td className="fw-bold" style={{ whiteSpace: 'nowrap' }}>
                            {o.shippingAddress?.name || 'Customer'}
                            {o.userEmail && <small className="text-muted d-block">{o.userEmail}</small>}
                          </td>
                          <td className="text-success fw-bold fs-6" style={{ whiteSpace: 'nowrap' }}>₹{o.totalPrice}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className="badge bg-info text-dark px-2 py-1">{o.paymentMethod || 'COD'}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className={`badge px-3 py-2 ${
                              o.status === 'Delivered' ? 'bg-success' : 
                              o.status === 'In Transit' || o.status === 'Shipped' || o.status === 'Out for Delivery' ? 'bg-primary' :
                              o.status && o.status.includes('Return') ? 'bg-warning text-dark' :
                              o.status && o.status.includes('Refund') ? 'bg-info text-dark' :
                              o.status === 'Cancelled' ? 'bg-danger' : 'bg-warning text-dark'
                            }`}>
                              {o.status || 'Processing'}
                            </span>
                          </td>
                          <td style={{ minWidth: '240px', whiteSpace: 'nowrap' }}>
                            <select 
                              className="form-select form-select-sm fw-bold shadow-sm" 
                              style={{ width: '100%', minWidth: '220px' }}
                              value={o.status || 'Processing'}
                              onChange={(e) => {
                                if (!orderId || orderId.startsWith('LOCAL_ID_')) {
                                  alert("Yeh order database me nahi hai. Kripya naya order place karein.");
                                  return;
                                }
                                handleOrderStatusChange(orderId, e.target.value);
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="In Transit">In Transit</option>
                              <option value="Out for Delivery">Out for Delivery</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Return Approved">Return Approved</option>
                              <option value="Replacement Shipped">Replacement Shipped</option>
                              <option value="Refund Processed">Refund Processed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RETURNS TAB */}
        {activeTab === 'returns' && hasTabAccess(userRole, 'returns') && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0">🔄 Customer Return & Refund Requests</h3>
              <button className="btn btn-outline-primary btn-sm fw-bold" onClick={fetchData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Sync Return Requests
              </button>
            </div>

            <div className="card border-0 shadow-sm p-3 bg-white">
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle m-0">
                  <thead className="table-dark text-nowrap">
                    <tr>
                      <th style={{ minWidth: '160px' }}>Order ID</th>
                      <th style={{ minWidth: '200px' }}>Customer Name</th>
                      <th style={{ minWidth: '160px' }}>Request Type</th>
                      <th style={{ minWidth: '220px' }}>Reason & Details</th>
                      <th style={{ minWidth: '160px' }}>Current Status</th>
                      <th style={{ minWidth: '250px' }}>Process Request Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-nowrap">
                    {orders.filter(o => o.status && o.status.includes('Return')).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-5 text-muted">
                          <i className="bi bi-arrow-counterclockwise fs-2 d-block mb-2 text-secondary"></i>
                          <h5>No active return or refund requests found.</h5>
                        </td>
                      </tr>
                    ) : (
                      orders.filter(o => o.status && o.status.includes('Return')).map((o, idx) => {
                        const orderId = o._id || o.id || o.orderId || null;
                        return (
                        <tr key={orderId || idx}>
                          <td className="fw-bold text-primary">#{orderId ? orderId : 'N/A'}</td>
                          <td className="fw-bold">
                            {o.shippingAddress?.name || 'Customer'}
                            <small className="text-muted d-block">{o.userEmail}</small>
                          </td>
                          <td>
                            <span className="badge bg-danger px-3 py-2 fw-bold">
                              {o.returnRequest?.returnType || 'Refund / Replace'}
                            </span>
                          </td>
                          <td>
                            <strong className="text-dark d-block">{o.returnRequest?.reason || 'Defective / Damaged'}</strong>
                            <small className="text-muted">{o.returnRequest?.comments || 'No extra comments provided.'}</small>
                          </td>
                          <td>
                            <span className="badge bg-warning text-dark px-3 py-2 fw-bold fs-6">
                              {o.status}
                            </span>
                          </td>
                          <td>
                            <select 
                              className="form-select form-select-sm fw-bold border-danger" 
                              style={{ width: '100%', minWidth: '220px' }}
                              value={o.status}
                              onChange={(e) => {
                                if (!orderId || orderId.startsWith('LOCAL_ID_')) {
                                  alert("Yeh order database me nahi hai.");
                                  return;
                                }
                                handleOrderStatusChange(orderId, e.target.value);
                              }}
                            >
                              <option value={o.status}>-- Action --</option>
                              <option value="Return Approved">✅ Approve Return Request</option>
                              <option value="Replacement Shipped">🚚 Ship Replacement Unit</option>
                              <option value="Refund Processed">💵 Refund Money to Customer</option>
                              <option value="Delivered">❌ Reject Return Request</option>
                            </select>
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && hasTabAccess(userRole, 'reviews') && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0">⭐ Customer Ratings & Feedback Reviews</h3>
              <button className="btn btn-outline-primary btn-sm fw-bold" onClick={fetchData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Sync Reviews
              </button>
            </div>

            <div className="card border-0 shadow-sm p-3 bg-white">
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle m-0">
                  <thead className="table-dark text-nowrap">
                    <tr>
                      <th style={{ minWidth: '160px' }}>Order ID</th>
                      <th style={{ minWidth: '200px' }}>Customer Name</th>
                      <th style={{ minWidth: '130px' }}>Rating</th>
                      <th style={{ minWidth: '250px' }}>Review Comment</th>
                      <th style={{ minWidth: '130px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-nowrap">
                    {reviews.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-5 text-muted">
                          <i className="bi bi-chat-square-quote fs-2 d-block mb-2 text-secondary"></i>
                          <h5>No customer reviews submitted yet.</h5>
                        </td>
                      </tr>
                    ) : (
                      reviews.map((rev, idx) => {
                        const reviewId = rev.orderId || rev.id || rev._id || `REV_${idx}`;
                        return (
                        <tr key={idx}>
                          <td className="fw-bold text-primary">#{reviewId}</td>
                          <td className="fw-bold">{rev.customerName} <small className="text-muted d-block">{rev.customerEmail}</small></td>
                          <td>
                            <span className="badge bg-warning text-dark fw-bold fs-6">
                              {'★'.repeat(rev.rating || 5)} {rev.rating}/5
                            </span>
                          </td>
                          <td className="fw-semibold text-dark">{rev.comment || 'No comment provided'}</td>
                          <td className="small text-muted">{rev.date || 'Recent'}</td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COUPONS TAB */}
        {activeTab === 'coupons' && hasTabAccess(userRole, 'coupons') && (
          <div>
            <h3 className="fw-bold mb-4">Marketing & Discount Coupon Engine</h3>
            <div className="row g-4">
              <div className="col-md-5">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">Create Category Promo Code</h5>
                  <form onSubmit={handleAddCoupon}>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Coupon Code</label>
                      <input type="text" className="form-control" required placeholder="e.g. PAPAJIONTOP, TECH10" value={newCouponCode} onChange={(e) => setNewCouponCode(e.target.value)} />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Applicable Category</label>
                      <select 
                        className="form-select fw-bold text-primary"
                        value={newCouponCategory}
                        onChange={(e) => setNewCouponCategory(e.target.value)}
                      >
                        <option value="All">🌟 All Categories (Global Discount)</option>
                        {rawCategoriesList.map((cat, idx) => (
                          <option key={idx} value={cat.name}>📦 {cat.name} Only</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Discount Percentage (%)</label>
                      <input type="number" className="form-control" required placeholder="e.g. 20" value={newCouponDiscount} onChange={(e) => setNewCouponDiscount(e.target.value)} />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">Total Redemption / Customer Limit</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        required 
                        placeholder="e.g. 10 (Max 10 customers can use)" 
                        value={newCouponMaxUsage} 
                        onChange={(e) => setNewCouponMaxUsage(e.target.value)} 
                      />
                    </div>

                    <button type="submit" className="btn btn-success w-100 fw-bold py-2">Publish Coupon Live</button>
                  </form>
                </div>
              </div>

              <div className="col-md-7">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold mb-3">Active Promotional Coupons ({coupons.length})</h5>
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover align-middle m-0">
                      <thead className="table-dark text-nowrap">
                        <tr>
                          <th>Code</th>
                          <th>Category</th>
                          <th>Discount</th>
                          <th>Redemption Usage</th>
                          <th>Target User</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-nowrap">
                        {coupons.map((c) => {
                          const couponId = c._id || c.code;
                          return (
                          <tr key={couponId}>
                            <td className="fw-bold text-primary">{c.code}</td>
                            <td>
                              <span className={`badge ${c.category === 'All' ? 'bg-primary' : 'bg-info text-dark'} fw-bold`}>
                                {c.category || 'All'}
                              </span>
                            </td>
                            <td className="fw-bold text-success">{c.discount}% OFF</td>
                            <td>
                              <span className={`badge ${(c.usedCount || 0) >= (c.maxUsage || 100) ? 'bg-danger' : 'bg-secondary'} px-2 py-1`}>
                                {c.usedCount || 0} / {c.maxUsage || 100} Used
                              </span>
                            </td>
                            <td>
                              {c.targetUserEmail ? (
                                <span className="badge bg-warning text-dark fw-bold">🎯 {c.targetUserEmail}</span>
                              ) : <span className="badge bg-secondary">Global (All Users)</span>}
                            </td>
                            <td>
                              <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => handleDeleteCoupon(couponId)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <h3 className="fw-bold m-0">👥 Customer Intelligence & Abandoned Recovery</h3>
              
              <div className="d-flex align-items-center gap-2">
                <select 
                  className="form-select form-select-sm fw-bold border-warning text-dark"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  style={{ width: '250px' }}
                >
                  <option value="ALL">🌟 All Store Customers ({customersList.length})</option>
                  <option value="CART">🛒 Abandoned Cart Customers Only</option>
                  <option value="WISHLIST">❤️ Wishlist Left Customers Only</option>
                </select>

                <button className="btn btn-outline-primary btn-sm fw-bold" onClick={fetchData}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Sync Customers
                </button>
              </div>
            </div>

            <div className="card border-0 shadow-sm p-3 bg-white">
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle m-0">
                  <thead className="table-dark text-nowrap">
                    <tr>
                      <th style={{ minWidth: '180px' }}>Customer Name</th>
                      <th style={{ minWidth: '220px' }}>Email & Mobile</th>
                      <th style={{ minWidth: '200px' }}>🛒 Cart Left Items</th>
                      <th style={{ minWidth: '200px' }}>❤️ Wishlist Saved Items</th>
                      <th style={{ minWidth: '180px' }}>Action & Recovery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-5 text-muted">
                          <i className="bi bi-people fs-2 d-block mb-2 text-secondary"></i>
                          <h5>No customers found matching this filter.</h5>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <tr key={cust._id || cust.email}>
                          <td className="fw-bold text-dark">{cust.name}</td>
                          <td>
                            <span className="fw-semibold text-primary d-block">{cust.email}</span>
                            <small className="text-muted">{cust.mobile || 'No Mobile Registered'}</small>
                          </td>
                          <td>
                            {cust.cart && cust.cart.length > 0 ? (
                              <div>
                                <span className="badge bg-warning text-dark mb-1">{cust.cart.length} Products in Cart</span>
                                <div className="small text-truncate" style={{ maxWidth: '200px' }}>
                                  {cust.cart.map(i => i.name).join(', ')}
                                </div>
                              </div>
                            ) : <span className="text-muted small">Empty Cart</span>}
                          </td>
                          <td>
                            {cust.wishlist && cust.wishlist.length > 0 ? (
                              <div>
                                <span className="badge bg-danger mb-1">{cust.wishlist.length} Products Wishlisted</span>
                                <div className="small text-truncate" style={{ maxWidth: '200px' }}>
                                  {cust.wishlist.map(i => i.name).join(', ')}
                                </div>
                              </div>
                            ) : <span className="text-muted small">No Wishlist</span>}
                          </td>
                          <td>
                            <button 
                              className="btn btn-sm btn-success fw-bold px-3 py-1 shadow-sm"
                              onClick={() => {
                                setSelectedTargetCustomer(cust);
                                setPersonalCouponCode(`OFFER_${cust.name ? cust.name.split(' ')[0].toUpperCase() : 'USER'}_${Math.floor(100 + Math.random() * 900)}`);
                                setShowPersonalDiscountModal(true);
                              }}
                            >
                              🎁 Offer Extra Discount
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN USERS TAB */}
        {activeTab === 'admin-users' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <h3 className="fw-bold m-0">⚙️ Admin & Staff Users Management</h3>
              <button 
                className="btn btn-primary fw-bold btn-sm shadow-sm"
                onClick={() => {
                  setEditingAdminUser(null);
                  setAdminFormData({ name: '', email: '', password: '', role: 'Admin', mobile: '' });
                  setShowAddAdminModal(true);
                }}
              >
                ➕ Create New Admin / Staff
              </button>
            </div>

            <div className="card border-0 shadow-sm p-3 bg-white">
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle m-0">
                  <thead className="table-dark text-nowrap">
                    <tr>
                      <th>Name</th>
                      <th>Email & Mobile</th>
                      <th>Role / Permission</th>
                      <th>Created Date</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsersList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-5 text-muted">
                          <i className="bi bi-shield-lock fs-2 d-block mb-2 text-secondary"></i>
                          <h5>No admin or staff users found in database.</h5>
                        </td>
                      </tr>
                    ) : (
                      adminUsersList.map((adm) => {
                        const admId = adm._id || adm.id;
                        return (
                          <tr key={admId}>
                            <td className="fw-bold text-dark">{adm.name}</td>
                            <td>
                              <span className="fw-semibold text-primary d-block">{adm.email}</span>
                              <small className="text-muted">{adm.mobile || 'No Mobile'}</small>
                            </td>
                            <td>
                              <span className={`badge ${adm.role === 'SuperAdmin' ? 'bg-danger' : 'bg-info text-dark'} px-2 py-1`}>
                                {adm.role || 'Admin'}
                              </span>
                            </td>
                            <td className="small text-muted">
                              {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                            </td>
                            <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                              <button 
                                className="btn btn-sm btn-outline-primary fw-bold me-2"
                                onClick={() => {
                                  setEditingAdminUser(adm);
                                  setAdminFormData({ name: adm.name, email: adm.email, password: '', role: adm.role || 'Admin', mobile: adm.mobile || '' });
                                  setShowAddAdminModal(true);
                                }}
                              >
                                Edit
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger fw-bold"
                                onClick={() => handleDeleteAdminUser(admId)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;