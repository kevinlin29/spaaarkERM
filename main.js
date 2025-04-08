const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('./db/database');

let mainWindow;
let db;
let dbSelectionWindow;

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('app/index.html');
  
  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Create database selection window
function createDbSelectionWindow() {
  dbSelectionWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  dbSelectionWindow.loadFile('app/db-select.html');
  dbSelectionWindow.setMenuBarVisibility(false);
  
  // Open DevTools for debugging
  // dbSelectionWindow.webContents.openDevTools();
  
  dbSelectionWindow.on('closed', function () {
    dbSelectionWindow = null;
    
    // If no main window and db selection window is closed, quit app
    if (!mainWindow) {
      app.quit();
    }
  });
}

app.on('ready', async () => {
  createDbSelectionWindow();
});

// Handle database selection or creation
async function initializeDatabase(dbName) {
  try {
    // Initialize the database with the selected/created name
    await Database.initDb(dbName);
    db = Database.getDb();
    
    // Seed the database with initial data
    await Database.seedDb();
    
    // Create the main application window
    createWindow();
    
    // Close the selection window
    if (dbSelectionWindow) {
      dbSelectionWindow.close();
      dbSelectionWindow = null;
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    dialog.showErrorBox('Database Error', `Failed to initialize database: ${error.message}`);
    app.quit();
  }
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null && dbSelectionWindow === null) {
    createDbSelectionWindow();
  }
});

// IPC Handlers for database operations
// Database selection
ipcMain.handle('get-existing-databases', async () => {
  return await Database.getExistingDatabases();
});

ipcMain.handle('select-database', async (event, dbName) => {
  await initializeDatabase(dbName);
});

ipcMain.handle('get-database-name', async () => {
  return Database.getDbName();
});

// Users
ipcMain.handle('get-users', async () => {
  return await Database.all('SELECT * FROM Users');
});

ipcMain.handle('add-user', async (event, user) => {
  const result = await Database.run(
    'INSERT INTO Users (name, email) VALUES (?, ?)',
    [user.name, user.email]
  );
  return { id: result.lastID, ...user };
});

ipcMain.handle('update-user', async (event, user) => {
  await Database.run(
    'UPDATE Users SET name = ?, email = ? WHERE id = ?',
    [user.name, user.email, user.id]
  );
  return user;
});

ipcMain.handle('delete-user', async (event, id) => {
  return await Database.run('DELETE FROM Users WHERE id = ?', [id]);
});

// Projects
ipcMain.handle('get-projects', async (event, userId) => {
  let query = `
    SELECT p.id, p.user_id, p.name, p.description, 
           p.pricing_method, p.markup_percentage, p.price_per_gram, p.price_per_hour,
           u.name as user_name 
    FROM Projects p 
    JOIN Users u ON p.user_id = u.id
  `;
  
  const params = [];
  if (userId) {
    query += ' WHERE p.user_id = ?';
    params.push(userId);
  }
  
  return await Database.all(query, params);
});

ipcMain.handle('add-project', async (event, project) => {
  const { user_id, name, description, pricing_method, markup_percentage, price_per_gram, price_per_hour } = project;
  
  const result = await Database.run(
    'INSERT INTO Projects (user_id, name, description, pricing_method, markup_percentage, price_per_gram, price_per_hour) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user_id, name, description, pricing_method || 'none', markup_percentage || 50, price_per_gram || 0.10, price_per_hour || 20.00]
  );
  
  return { id: result.lastID, ...project };
});

ipcMain.handle('update-project', async (event, project) => {
  const { id, user_id, name, description, pricing_method, markup_percentage, price_per_gram, price_per_hour } = project;
  
  await Database.run(
    'UPDATE Projects SET user_id = ?, name = ?, description = ?, pricing_method = ?, markup_percentage = ?, price_per_gram = ?, price_per_hour = ? WHERE id = ?',
    [user_id, name, description, pricing_method || 'none', markup_percentage || 50, price_per_gram || 0.10, price_per_hour || 20.00, id]
  );
  
  return project;
});

ipcMain.handle('delete-project', async (event, id) => {
  // First delete all plates associated with this project
  await Database.run('DELETE FROM Plates WHERE project_id = ?', [id]);
  
  // Then delete the project
  await Database.run('DELETE FROM Projects WHERE id = ?', [id]);
  
  return { success: true };
});

ipcMain.handle('get-project-pricing', async (event, projectId) => {
  const query = `
    SELECT pricing_method, markup_percentage, price_per_gram, price_per_hour
    FROM Projects
    WHERE id = ?
  `;
  
  return await Database.get(query, [projectId]);
});

// Materials
ipcMain.handle('get-materials', async () => {
  return await Database.all('SELECT * FROM Materials');
});

ipcMain.handle('add-material', async (event, material) => {
  const result = await Database.run(
    'INSERT INTO Materials (name, color, cost_per_gram, quantity_remaining) VALUES (?, ?, ?, ?)',
    [material.name, material.color, material.cost_per_gram, material.quantity_remaining]
  );
  return { id: result.lastID, ...material };
});

ipcMain.handle('update-material', async (event, material) => {
  await Database.run(
    'UPDATE Materials SET name = ?, color = ?, cost_per_gram = ?, quantity_remaining = ? WHERE id = ?',
    [material.name, material.color, material.cost_per_gram, material.quantity_remaining, material.id]
  );
  return material;
});

ipcMain.handle('delete-material', async (event, id) => {
  return await Database.run('DELETE FROM Materials WHERE id = ?', [id]);
});

// Plates
ipcMain.handle('get-plates', async (event, projectId) => {
  const settings = await Database.all('SELECT key, value FROM Settings');
  const settingsObj = settings.reduce((obj, item) => {
    obj[item.key] = item.value;
    return obj;
  }, {});
  
  const costModel = settingsObj.cost_model || 'weight';
  const timeCostRate = parseFloat(settingsObj.time_cost_rate || 10);
  
  if (projectId) {
    return await Database.all(`
      SELECT Plates.*, Materials.name as material_name, Materials.color as color, Materials.cost_per_gram,
      (Plates.grams_used * Materials.cost_per_gram) as material_cost,
      (Plates.print_time * ?) as time_cost,
      CASE 
        WHEN ? = 'max' THEN 
          MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
        ELSE 
          (Plates.grams_used * Materials.cost_per_gram)
      END as cost,
      (Plates.price_sold - CASE 
        WHEN ? = 'max' THEN 
          MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
        ELSE 
          (Plates.grams_used * Materials.cost_per_gram)
      END) as profit
      FROM Plates
      JOIN Materials ON Plates.material_id = Materials.id
      WHERE Plates.project_id = ?
    `, [timeCostRate, costModel, timeCostRate, costModel, timeCostRate, projectId]);
  }
  
  return await Database.all(`
    SELECT Plates.*, Projects.name as project_name, Materials.name as material_name, 
    Materials.color as color, Materials.cost_per_gram, Users.name as user_name,
    (Plates.grams_used * Materials.cost_per_gram) as material_cost,
    (Plates.print_time * ?) as time_cost,
    CASE 
      WHEN ? = 'max' THEN 
        MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
      ELSE 
        (Plates.grams_used * Materials.cost_per_gram)
    END as cost,
    (Plates.price_sold - CASE 
      WHEN ? = 'max' THEN 
        MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
      ELSE 
        (Plates.grams_used * Materials.cost_per_gram)
    END) as profit
    FROM Plates
    JOIN Projects ON Plates.project_id = Projects.id
    JOIN Materials ON Plates.material_id = Materials.id
    JOIN Users ON Projects.user_id = Users.id
  `, [timeCostRate, costModel, timeCostRate, costModel, timeCostRate]);
});

ipcMain.handle('add-plate', async (event, plate) => {
  // First update the material quantity
  await Database.run(
    'UPDATE Materials SET quantity_remaining = quantity_remaining - ? WHERE id = ?',
    [plate.grams_used, plate.material_id]
  );
  
  // Then insert the plate
  const result = await Database.run(
    'INSERT INTO Plates (project_id, material_id, grams_used, print_time, price_sold, date) VALUES (?, ?, ?, ?, ?, ?)',
    [
      plate.project_id, 
      plate.material_id, 
      plate.grams_used,
      plate.print_time || 0,
      plate.price_sold, 
      plate.date || new Date().toISOString()
    ]
  );
  
  return { id: result.lastID, ...plate };
});

ipcMain.handle('update-plate', async (event, plate) => {
  // Get the original plate to calculate material difference
  const originalPlate = await Database.get('SELECT * FROM Plates WHERE id = ?', [plate.id]);
  const gramsDifference = originalPlate.grams_used - plate.grams_used;
  
  // Update material quantity if changed
  if (originalPlate.material_id === plate.material_id && gramsDifference !== 0) {
    await Database.run(
      'UPDATE Materials SET quantity_remaining = quantity_remaining + ? WHERE id = ?',
      [gramsDifference, plate.material_id]
    );
  } else if (originalPlate.material_id !== plate.material_id) {
    // Return original material
    await Database.run(
      'UPDATE Materials SET quantity_remaining = quantity_remaining + ? WHERE id = ?',
      [originalPlate.grams_used, originalPlate.material_id]
    );
    
    // Deduct from new material
    await Database.run(
      'UPDATE Materials SET quantity_remaining = quantity_remaining - ? WHERE id = ?',
      [plate.grams_used, plate.material_id]
    );
  }
  
  // Update the plate
  await Database.run(
    'UPDATE Plates SET project_id = ?, material_id = ?, grams_used = ?, print_time = ?, price_sold = ?, date = ? WHERE id = ?',
    [
      plate.project_id, 
      plate.material_id, 
      plate.grams_used,
      plate.print_time || 0,
      plate.price_sold, 
      plate.date, 
      plate.id
    ]
  );
  
  return plate;
});

ipcMain.handle('delete-plate', async (event, id) => {
  // Get the plate to return material to inventory
  const plate = await Database.get('SELECT * FROM Plates WHERE id = ?', [id]);
  
  // Return material to inventory
  await Database.run(
    'UPDATE Materials SET quantity_remaining = quantity_remaining + ? WHERE id = ?',
    [plate.grams_used, plate.material_id]
  );
  
  // Delete the plate
  return await Database.run('DELETE FROM Plates WHERE id = ?', [id]);
});

// Statistics and Reports
ipcMain.handle('get-stats', async (event, startDate, endDate) => {
  const settings = await Database.all('SELECT key, value FROM Settings');
  const settingsObj = settings.reduce((obj, item) => {
    obj[item.key] = item.value;
    return obj;
  }, {});
  
  const costModel = settingsObj.cost_model || 'weight';
  const timeCostRate = parseFloat(settingsObj.time_cost_rate || 10);
  
  let query = `
    SELECT 
      COUNT(*) as total_plates,
      SUM(Plates.grams_used) as total_material_used,
      SUM(Plates.print_time) as total_print_time,
      SUM(Plates.price_sold) as total_sales,
      SUM(Plates.grams_used * Materials.cost_per_gram) as total_material_cost,
      SUM(Plates.print_time * ?) as total_time_cost,
      SUM(CASE 
        WHEN ? = 'max' THEN 
          MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
        ELSE 
          (Plates.grams_used * Materials.cost_per_gram)
      END) as total_cost,
      SUM(Plates.price_sold - CASE 
        WHEN ? = 'max' THEN 
          MAX(Plates.grams_used * Materials.cost_per_gram, Plates.print_time * ?)
        ELSE 
          (Plates.grams_used * Materials.cost_per_gram)
      END) as total_profit
    FROM Plates
    JOIN Materials ON Plates.material_id = Materials.id
  `;
  
  if (startDate && endDate) {
    return await Database.get(query + ' WHERE Plates.date BETWEEN ? AND ?', 
      [timeCostRate, costModel, timeCostRate, costModel, timeCostRate, startDate, endDate]);
  }
  
  return await Database.get(query, [timeCostRate, costModel, timeCostRate, costModel, timeCostRate]);
});

ipcMain.handle('get-user-stats', async (event, userId, startDate, endDate) => {
  let query = `
    SELECT 
      COUNT(*) as total_plates,
      SUM(Plates.grams_used) as total_material_used,
      SUM(Plates.price_sold) as total_sales,
      SUM(Plates.grams_used * Materials.cost_per_gram) as total_cost,
      SUM(Plates.price_sold - (Plates.grams_used * Materials.cost_per_gram)) as total_profit
    FROM Plates
    JOIN Materials ON Plates.material_id = Materials.id
    JOIN Projects ON Plates.project_id = Projects.id
    WHERE Projects.user_id = ?
  `;
  
  if (startDate && endDate) {
    return await Database.get(query + ' AND Plates.date BETWEEN ? AND ?', [userId, startDate, endDate]);
  }
  
  return await Database.get(query, [userId]);
});

ipcMain.handle('get-project-stats', async (event, projectId, startDate, endDate) => {
  let query = `
    SELECT 
      COUNT(*) as total_plates,
      SUM(Plates.grams_used) as total_material_used,
      SUM(Plates.price_sold) as total_sales,
      SUM(Plates.grams_used * Materials.cost_per_gram) as total_cost,
      SUM(Plates.price_sold - (Plates.grams_used * Materials.cost_per_gram)) as total_profit
    FROM Plates
    JOIN Materials ON Plates.material_id = Materials.id
    WHERE Plates.project_id = ?
  `;
  
  if (startDate && endDate) {
    return await Database.get(query + ' AND Plates.date BETWEEN ? AND ?', [projectId, startDate, endDate]);
  }
  
  return await Database.get(query, [projectId]);
});

// Settings
ipcMain.handle('get-settings', async () => {
  const settings = await Database.all('SELECT key, value FROM Settings');
  // Convert to an object for easier access
  return settings.reduce((obj, item) => {
    obj[item.key] = item.value;
    return obj;
  }, {});
});

ipcMain.handle('update-setting', async (event, key, value) => {
  await Database.run(
    'INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)',
    [key, value]
  );
  return { key, value };
}); 