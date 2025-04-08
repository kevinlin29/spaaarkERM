const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Create db directory if it doesn't exist
const userDataPath = app.getPath('userData');
const dbDir = path.join(userDataPath, 'db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// The database path will be set when initDb is called
let dbPath;
let db;
let dbName = '3D Print ERM';

// Database initialization and schema creation
function initDb(customDbName = null) {
  return new Promise((resolve, reject) => {
    // Set database name if provided
    if (customDbName) {
      dbName = customDbName;
    }
    
    // Set database path using the sanitized name
    const sanitizedName = dbName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    dbPath = path.join(dbDir, `${sanitizedName}.db`);
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err);
          reject(err);
          return;
        }
        
        // Create Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT
          )
        `, (err) => {
          if (err) {
            console.error('Error creating Users table:', err);
            reject(err);
            return;
          }
          
          // Create Materials table
          db.run(`
            CREATE TABLE IF NOT EXISTS Materials (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              color TEXT,
              cost_per_gram REAL NOT NULL,
              quantity_remaining REAL NOT NULL
            )
          `, (err) => {
            if (err) {
              console.error('Error creating Materials table:', err);
              reject(err);
              return;
            }
            
            // Create Projects table
            db.run(`
              CREATE TABLE IF NOT EXISTS Projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                pricing_method TEXT DEFAULT 'none',
                markup_percentage INTEGER DEFAULT 50,
                price_per_gram REAL DEFAULT 0.10,
                price_per_hour REAL DEFAULT 20.00,
                FOREIGN KEY (user_id) REFERENCES Users(id)
              )
            `, (err) => {
              if (err) {
                console.error('Error creating Projects table:', err);
                reject(err);
                return;
              }
              
              // Check if we need to add the pricing fields to the Projects table
              db.all("PRAGMA table_info(Projects)", (err, columns) => {
                if (err) {
                  console.error('Error checking Projects table columns:', err);
                  // Continue anyway - don't reject here
                } else {
                  const hasPricingMethod = columns.some(col => col.name === 'pricing_method');
                  
                  if (!hasPricingMethod) {
                    // Add pricing fields to existing Projects table
                    const alterQueries = [
                      'ALTER TABLE Projects ADD COLUMN pricing_method TEXT DEFAULT "none"',
                      'ALTER TABLE Projects ADD COLUMN markup_percentage INTEGER DEFAULT 50',
                      'ALTER TABLE Projects ADD COLUMN price_per_gram REAL DEFAULT 0.10',
                      'ALTER TABLE Projects ADD COLUMN price_per_hour REAL DEFAULT 20.00'
                    ];
                    
                    alterQueries.forEach(query => {
                      db.run(query, (err) => {
                        if (err) {
                          console.error(`Error adding column with query ${query}:`, err);
                          // Don't reject here, continue with other columns
                        }
                      });
                    });
                  }
                }
                
                // Create Plates table with print_time field
                db.run(`
                  CREATE TABLE IF NOT EXISTS Plates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    material_id INTEGER NOT NULL,
                    grams_used REAL NOT NULL,
                    print_time REAL DEFAULT 0,
                    price_sold REAL NOT NULL,
                    date TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES Projects(id),
                    FOREIGN KEY (material_id) REFERENCES Materials(id)
                  )
                `, (err) => {
                  if (err) {
                    console.error('Error creating Plates table:', err);
                    reject(err);
                    return;
                  }
                  
                  // Create Settings table for app configuration
                  db.run(`
                    CREATE TABLE IF NOT EXISTS Settings (
                      key TEXT PRIMARY KEY,
                      value TEXT NOT NULL
                    )
                  `, (err) => {
                    if (err) {
                      console.error('Error creating Settings table:', err);
                      reject(err);
                      return;
                    }
                    
                    // Save the database name in settings
                    db.run('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)', 
                           ['database_name', dbName], 
                           (err) => {
                      if (err) {
                        console.error('Error saving database name:', err);
                        // Continue anyway - don't reject
                      }
                      
                      // Check if we need to add the print_time column to the Plates table
                      db.all("PRAGMA table_info(Plates)", (err, columns) => {
                        if (err) {
                          console.error('Error checking Plates table columns:', err);
                          reject(err);
                          return;
                        }
                        
                        const hasPrintTime = columns.some(col => col.name === 'print_time');
                        
                        if (!hasPrintTime) {
                          // Add print_time column to existing Plates table
                          db.run('ALTER TABLE Plates ADD COLUMN print_time REAL DEFAULT 0', (err) => {
                            if (err) {
                              console.error('Error adding print_time column:', err);
                              // Don't reject here, as SQLite might throw an error if the column already exists
                              // but we want to continue initialization
                            }
                            resolve(db);
                          });
                        } else {
                          resolve(db);
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Get the database instance
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

// Get the database name
function getDbName() {
  return dbName;
}

// Get list of existing databases
function getExistingDatabases() {
  return new Promise((resolve, reject) => {
    fs.readdir(dbDir, (err, files) => {
      if (err) {
        console.error('Error reading db directory:', err);
        reject(err);
        return;
      }
      
      // Filter for .db files and extract database names
      const databases = files
        .filter(file => file.endsWith('.db'))
        .map(file => {
          const basename = path.basename(file, '.db');
          // Convert sanitized name back to a more readable format (replace underscores with spaces)
          return basename.replace(/_/g, ' ');
        });
      
      resolve(databases);
    });
  });
}

// Insert initial data if tables are empty
function seedDb() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    // Check if Users table is empty
    db.get('SELECT COUNT(*) as count FROM Users', (err, row) => {
      if (err) {
        console.error('Error checking Users count:', err);
        reject(err);
        return;
      }
      
      if (row.count === 0) {
        // Insert Users
        db.run('INSERT INTO Users (name, email) VALUES (?, ?)', ['Alice Smith', 'alice@example.com'], (err) => {
          if (err) {
            console.error('Error inserting user Alice:', err);
            reject(err);
            return;
          }
          
          db.run('INSERT INTO Users (name, email) VALUES (?, ?)', ['Bob Jones', 'bob@example.com'], (err) => {
            if (err) {
              console.error('Error inserting user Bob:', err);
              reject(err);
              return;
            }
            
            seedMaterials();
          });
        });
      } else {
        seedMaterials();
      }
    });
    
    function seedMaterials() {
      // Check if Materials table is empty
      db.get('SELECT COUNT(*) as count FROM Materials', (err, row) => {
        if (err) {
          console.error('Error checking Materials count:', err);
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          // Insert Materials
          db.run('INSERT INTO Materials (name, color, cost_per_gram, quantity_remaining) VALUES (?, ?, ?, ?)', 
                 ['PLA', 'White', 0.05, 1000], (err) => {
            if (err) {
              console.error('Error inserting material PLA:', err);
              reject(err);
              return;
            }
            
            db.run('INSERT INTO Materials (name, color, cost_per_gram, quantity_remaining) VALUES (?, ?, ?, ?)',
                   ['PETG', 'Black', 0.06, 800], (err) => {
              if (err) {
                console.error('Error inserting material PETG:', err);
                reject(err);
                return;
              }
              
              db.run('INSERT INTO Materials (name, color, cost_per_gram, quantity_remaining) VALUES (?, ?, ?, ?)',
                     ['ABS', 'Red', 0.07, 500], (err) => {
                if (err) {
                  console.error('Error inserting material ABS:', err);
                  reject(err);
                  return;
                }
                
                seedProjects();
              });
            });
          });
        } else {
          seedProjects();
        }
      });
    }
    
    function seedProjects() {
      // Check if Projects table is empty
      db.get('SELECT COUNT(*) as count FROM Projects', (err, row) => {
        if (err) {
          console.error('Error checking Projects count:', err);
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          // Insert Projects
          db.run('INSERT INTO Projects (user_id, name, description) VALUES (?, ?, ?)',
                 [1, 'RC Car Project', 'Multiple body parts for a remote control car'], (err) => {
            if (err) {
              console.error('Error inserting RC Car Project:', err);
              reject(err);
              return;
            }
            
            db.run('INSERT INTO Projects (user_id, name, description) VALUES (?, ?, ?)',
                   [2, 'Art Sculptures', 'Custom figurines and geometric designs'], (err) => {
              if (err) {
                console.error('Error inserting Art Sculptures project:', err);
                reject(err);
                return;
              }
              
              seedPlates();
            });
          });
        } else {
          seedPlates();
        }
      });
    }
    
    function seedPlates() {
      // Check if Plates table is empty
      db.get('SELECT COUNT(*) as count FROM Plates', (err, row) => {
        if (err) {
          console.error('Error checking Plates count:', err);
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          // Insert Plates
          db.run('INSERT INTO Plates (project_id, material_id, grams_used, print_time, price_sold) VALUES (?, ?, ?, ?, ?)',
                 [1, 1, 120, 2.5, 20.00], (err) => {
            if (err) {
              console.error('Error inserting plate 1:', err);
              reject(err);
              return;
            }
            
            db.run('INSERT INTO Plates (project_id, material_id, grams_used, print_time, price_sold) VALUES (?, ?, ?, ?, ?)',
                   [1, 2, 150, 3.2, 25.00], (err) => {
              if (err) {
                console.error('Error inserting plate 2:', err);
                reject(err);
                return;
              }
              
              db.run('INSERT INTO Plates (project_id, material_id, grams_used, print_time, price_sold) VALUES (?, ?, ?, ?, ?)',
                     [2, 3, 100, 1.8, 30.00], (err) => {
                if (err) {
                  console.error('Error inserting plate 3:', err);
                  reject(err);
                  return;
                }
                
                seedSettings();
              });
            });
          });
        } else {
          seedSettings();
        }
      });
    }
    
    function seedSettings() {
      // Check if Settings table is empty
      db.get('SELECT COUNT(*) as count FROM Settings', (err, row) => {
        if (err) {
          console.error('Error checking Settings count:', err);
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          // Insert default settings
          db.run('INSERT INTO Settings (key, value) VALUES (?, ?)',
                 ['cost_model', 'weight'], (err) => {
            if (err) {
              console.error('Error inserting cost_model setting:', err);
              reject(err);
              return;
            }
            
            db.run('INSERT INTO Settings (key, value) VALUES (?, ?)',
                   ['time_cost_rate', '10.00'], (err) => {
              if (err) {
                console.error('Error inserting time_cost_rate setting:', err);
                reject(err);
                return;
              }
              
              resolve();
            });
          });
        } else {
          resolve();
        }
      });
    }
  });
}

// Execute a query and get all results
function all(query, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// Execute a query and get the first result
function get(query, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(query, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Execute a query and return the lastID and changes
function run(query, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(query, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  initDb,
  getDb,
  seedDb,
  all,
  get,
  run,
  getDbName,
  getExistingDatabases
}; 