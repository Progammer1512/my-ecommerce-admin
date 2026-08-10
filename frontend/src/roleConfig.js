// src/roleConfig.js

export const ROLE_PERMISSIONS = {
  SuperAdmin: {
    name: 'Super Admin',
    allowedTabs: ['dashboard', 'banners', 'products', 'orders', 'returns', 'reviews', 'coupons'],
  },
  InventoryManager: {
    name: 'Inventory Manager',
    allowedTabs: ['products', 'orders'],
  },
  Staff: {
    name: 'Support Staff',
    allowedTabs: ['orders', 'returns'],
  }
};

export const hasTabAccess = (userRole, tabName) => {
  if (!userRole) return false;
  const cleanRole = userRole.toString().toLowerCase().replace(/\s+/g, '');
  
  for (const [key, config] of Object.entries(ROLE_PERMISSIONS)) {
    if (key.toLowerCase() === cleanRole) {
      return config.allowedTabs.includes(tabName);
    }
  }
  // Fallback for general admin variations
  if (cleanRole.includes('admin')) return true;
  return ['orders', 'returns'].includes(tabName);
};