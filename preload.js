const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // User operations
    getUsers: () => ipcRenderer.invoke('get-users'),
    addUser: (user) => ipcRenderer.invoke('add-user', user),
    updateUser: (user) => ipcRenderer.invoke('update-user', user),
    deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
    
    // Project operations
    getProjects: (userId = null) => ipcRenderer.invoke('get-projects', userId),
    addProject: (project) => ipcRenderer.invoke('add-project', project),
    updateProject: (project) => ipcRenderer.invoke('update-project', project),
    deleteProject: (id) => ipcRenderer.invoke('delete-project', id),
    getProjectPricing: (projectId) => ipcRenderer.invoke('get-project-pricing', projectId),
    
    // Material operations
    getMaterials: () => ipcRenderer.invoke('get-materials'),
    addMaterial: (material) => ipcRenderer.invoke('add-material', material),
    updateMaterial: (material) => ipcRenderer.invoke('update-material', material),
    deleteMaterial: (id) => ipcRenderer.invoke('delete-material', id),
    
    // Plate operations
    getPlates: (projectId = null) => ipcRenderer.invoke('get-plates', projectId),
    addPlate: (plate) => ipcRenderer.invoke('add-plate', plate),
    updatePlate: (plate) => ipcRenderer.invoke('update-plate', plate),
    deletePlate: (id) => ipcRenderer.invoke('delete-plate', id),
    
    // Settings operations
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value),
    
    // Report operations
    getStats: (startDate = null, endDate = null) => ipcRenderer.invoke('get-stats', startDate, endDate),
    getUserStats: (userId, startDate = null, endDate = null) => ipcRenderer.invoke('get-user-stats', userId, startDate, endDate),
    getProjectStats: (projectId, startDate = null, endDate = null) => ipcRenderer.invoke('get-project-stats', projectId, startDate, endDate),
    exportReport: (type, data) => ipcRenderer.invoke('export-report', type, data),

    // Database operations
    getExistingDatabases: () => ipcRenderer.invoke('get-existing-databases'),
    selectDatabase: (dbName) => ipcRenderer.invoke('select-database', dbName),
    getDatabaseName: () => ipcRenderer.invoke('get-database-name')
  }
); 