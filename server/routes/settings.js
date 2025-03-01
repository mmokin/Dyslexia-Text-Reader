const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

// Get user settings
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const settings = await Settings.findOne({ userId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found for this user' });
    }
    
    res.json(settings);
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error getting settings' });
  }
});

// Update user settings
router.post('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { settings, apiKeys } = req.body;
    
    // Ensure the auth user matches the requested userId
    if (req.user.id !== userId && req.user.id.toString() !== userId) {
      return res.status(401).json({ message: 'Unauthorized: You can only update your own settings' });
    }
    
    // Find existing settings or create new ones
    let userSettings = await Settings.findOne({ userId });
    
    if (!userSettings) {
      userSettings = new Settings({
        userId,
        settings: settings || {},
        apiKeys: apiKeys || {}
      });
    } else {
      // Update existing settings
      if (settings) {
        userSettings.settings = {
          ...userSettings.settings,
          ...settings
        };
      }
      
      // Update API keys if provided
      if (apiKeys) {
        userSettings.apiKeys = {
          ...userSettings.apiKeys,
          ...apiKeys
        };
      }
      
      userSettings.updatedAt = Date.now();
    }
    
    // Save settings
    await userSettings.save();
    
    res.json({ 
      message: 'Settings updated successfully',
      settings: userSettings.settings
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error updating settings' });
  }
});

module.exports = router;