const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/orderModel');

// Safe Mongoose Product Model Retrieval
const getProductModel = () => {
  try {
    return mongoose.model('Product');
  } catch (e) {
    try {
      return require('../models/productModel');
    } catch (err) {
      return null;
    }
  }
};

// Helper Function: Deduct Inventory Stock in MongoDB (Only Once)
const deductInventoryStock = async (orderItems) => {
  if (!orderItems || !Array.isArray(orderItems)) return;

  const Product = getProductModel();
  if (!Product) {
    console.log('⚠️ Product Model not found. Skipping stock deduction.');
    return;
  }

  for (const item of orderItems) {
    try {
      const qtyToDeduct = Number(item.qty) || 1;
      let query = null;

      if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        query = { _id: item.product };
      } else if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        query = { _id: item._id };
      } else if (item.name) {
        query = { name: item.name };
      }

      if (query) {
        const dbProduct = await Product.findOne(query);
        if (dbProduct) {
          dbProduct.stock = Math.max(0, (dbProduct.stock || 0) - qtyToDeduct);
          await dbProduct.save();
          console.log(`📉 Stock Auto-Deducted: ${dbProduct.name} | New Stock: ${dbProduct.stock}`);
        }
      }
    } catch (err) {
      console.error('Stock Deduction Error:', err.message);
    }
  }
};

// Helper Function: Restore Stock (If Order is Cancelled or Returned)
const restoreInventoryStock = async (orderItems) => {
  if (!orderItems || !Array.isArray(orderItems)) return;

  const Product = getProductModel();
  if (!Product) return;

  for (const item of orderItems) {
    try {
      const qtyToRestore = Number(item.qty) || 1;
      let query = null;

      if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        query = { _id: item.product };
      } else if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        query = { _id: item._id };
      } else if (item.name) {
        query = { name: item.name };
      }

      if (query) {
        const dbProduct = await Product.findOne(query);
        if (dbProduct) {
          dbProduct.stock = (dbProduct.stock || 0) + qtyToRestore;
          await dbProduct.save();
          console.log(`📈 Stock Restored: ${dbProduct.name} | Total Stock: ${dbProduct.stock}`);
        }
      }
    } catch (err) {
      console.error('Stock Restoration Error:', err.message);
    }
  }
};

// 1. GET ALL ORDERS (For Admin Dashboard & Customer Portals from MongoDB)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// 2. CREATE NEW ORDER (Saved to MongoDB & Single Stock Deduction)
router.post('/', async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice, userEmail } = req.body;

    const customOrderId = 'ORD' + Math.floor(100000 + Math.random() * 900000);

    const newOrder = new Order({
      _id: customOrderId,
      orderItems: orderItems || [],
      shippingAddress: shippingAddress || {},
      paymentMethod: paymentMethod || 'Cash on Delivery (COD)',
      totalPrice: Number(totalPrice) || 0,
      userEmail: userEmail || 'guest@techstore.com',
      status: 'Processing',
      returnRequest: null
    });

    await newOrder.save();
    console.log('📦 New Customer Order Saved to MongoDB:', newOrder._id);

    // DEDUCT STOCK ONLY ONCE AT THE TIME OF ORDER CREATION
    await deductInventoryStock(newOrder.orderItems);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Order Creation Error:', error);
    res.status(500).json({ message: 'Failed to place order', error: error.message });
  }
});

// 3. SUBMIT RETURN / REPLACEMENT / REFUND REQUEST (From Customer App)
router.put('/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { returnType, reason, comments } = req.body;

    let targetOrder = await Order.findById(id);

    if (!targetOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    targetOrder.status = `Return Requested (${returnType})`;
    targetOrder.returnRequest = {
      returnType: returnType || 'Refund', // 'Refund' or 'Replacement'
      reason: reason || 'Product Defective',
      comments: comments || '',
      requestedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    await targetOrder.save();

    console.log(`🔄 Return Request Received for Order #${id} | Type: ${returnType}`);
    res.json({ message: 'Return request submitted successfully', order: targetOrder });
  } catch (error) {
    console.error('Return Request Error:', error);
    res.status(500).json({ message: 'Failed to submit return request' });
  }
});

// 4. UPDATE ORDER STATUS (From Admin Dashboard - Includes "In Transit")
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let targetOrder = await Order.findById(id);

    if (!targetOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const oldStatus = targetOrder.status;
    targetOrder.status = status;
    await targetOrder.save();

    console.log(`🚚 Order #${id} status changed: ${oldStatus} -> ${status}`);

    // Restores stock if order gets Cancelled or Return/Refund Processed
    if ((status === 'Cancelled' || status === 'Refund Processed' || status === 'Return Approved') && 
        !oldStatus.includes('Refund') && oldStatus !== 'Cancelled') {
      await restoreInventoryStock(targetOrder.orderItems);
    }

    const allOrders = await Order.find({}).sort({ createdAt: -1 });
    res.json({ message: 'Order status updated successfully', order: targetOrder, orders: allOrders });
  } catch (error) {
    res.status(500).json({ message: 'Status update failed', error: error.message });
  }
});

module.exports = router;