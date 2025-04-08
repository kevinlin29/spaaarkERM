// Global state
let currentView = 'dashboard';
let users = [];
let projects = [];
let materials = [];
let plates = [];
let settings = {
  cost_model: 'weight',
  time_cost_rate: 10.00,
  pricing_method: 'none',
  markup_percentage: 50,
  price_per_gram: 0.10,
  price_per_hour: 20.00
};

// DOM elements
const navLinks = document.querySelectorAll('.nav-menu a');
const views = document.querySelectorAll('.view');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  // Set up navigation
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      changeView(view);
    });
  });

  // Get and display the database name
  try {
    const dbName = await window.api.getDatabaseName();
    const appTitle = document.querySelector('.app-title h1');
    appTitle.textContent = dbName;
  } catch (error) {
    console.error('Error getting database name:', error);
  }

  // Initialize all modals
  initModals();
  
  // Initialize forms
  initForms();
  
  // Initialize filters
  initFilters();
  
  // Load settings first
  loadSettings().then(() => {
    // Load initial data
    loadDashboard();
    loadUsers();
    loadMaterials();
    loadProjects();
    loadPlates();
  });
});

// Change the current view
function changeView(view) {
  currentView = view;
  
  // Update navigation
  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === view) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Show active view
  views.forEach(viewElement => {
    if (viewElement.id === view) {
      viewElement.classList.add('active');
    } else {
      viewElement.classList.remove('active');
    }
  });
  
  // Refresh data when switching views
  if (view === 'dashboard') loadDashboard();
  if (view === 'users') loadUsers();
  if (view === 'projects') loadProjects();
  if (view === 'plates') loadPlates();
  if (view === 'materials') loadMaterials();
  if (view === 'reports') loadReportUserOptions();
}

// Load application settings
async function loadSettings() {
  try {
    const savedSettings = await window.api.getSettings();
    if (savedSettings) {
      settings = {
        ...settings, // keep defaults
        ...savedSettings // override with saved values
      };
      
      // Update UI elements with saved settings
      document.getElementById('cost-model-type').value = settings.cost_model || 'weight';
      document.getElementById('time-cost-rate').value = settings.time_cost_rate || 10.00;
      
      // Update pricing settings UI
      document.getElementById('pricing-method').value = settings.pricing_method || 'none';
      document.getElementById('markup-percentage').value = settings.markup_percentage || 50;
      document.getElementById('price-per-gram').value = settings.price_per_gram || 0.10;
      document.getElementById('price-per-hour').value = settings.price_per_hour || 20.00;
      
      // Toggle visibility based on settings
      updateTimeCostVisibility();
      updatePricingOptionVisibility();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Update time cost related UI elements visibility
function updateTimeCostVisibility() {
  const isMaxCostModel = settings.cost_model === 'max';
  
  // In the dashboard
  document.getElementById('time-cost-container').style.display = isMaxCostModel ? 'block' : 'none';
  
  // In the plate form
  const plateTimeContainer = document.getElementById('plate-time-container');
  const plateTimeCostContainer = document.getElementById('plate-time-cost-container');
  
  if (plateTimeContainer) {
    plateTimeContainer.style.display = isMaxCostModel ? 'block' : 'none';
  }
  
  if (plateTimeCostContainer) {
    plateTimeCostContainer.style.display = isMaxCostModel ? 'block' : 'none';
  }
}

// Update pricing option visibility based on the selected pricing method
function updatePricingOptionVisibility() {
  const pricingMethod = document.getElementById('pricing-method').value;
  
  // Hide all pricing options first
  document.querySelectorAll('.pricing-option').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show only the relevant option based on the selected method
  if (pricingMethod === 'markup') {
    document.getElementById('markup-container').style.display = 'block';
  } else if (pricingMethod === 'fixed-gram') {
    document.getElementById('price-per-gram-container').style.display = 'block';
  } else if (pricingMethod === 'fixed-hour') {
    document.getElementById('price-per-hour-container').style.display = 'block';
  }
}

// Initialize all modals
function initModals() {
  const modals = document.querySelectorAll('.modal');
  const closeButtons = document.querySelectorAll('.close');
  
  // Close modals when clicking the X
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modals.forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });
  
  // Close modals when clicking outside the modal content
  window.addEventListener('click', (e) => {
    modals.forEach(modal => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // Setup modal open buttons
  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());
  document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal());
  document.getElementById('add-plate-btn').addEventListener('click', () => openPlateModal());
  document.getElementById('add-material-btn').addEventListener('click', () => openMaterialModal());
}

// Initialize form submissions
function initForms() {
  // User form
  document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveUser();
  });
  
  // Project form
  document.getElementById('project-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProject();
  });
  
  // Plate form
  document.getElementById('plate-form').addEventListener('submit', (e) => {
    e.preventDefault();
    savePlate();
  });
  
  // Material form
  document.getElementById('material-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveMaterial();
  });
  
  // Cost model form
  document.getElementById('save-cost-model').addEventListener('click', saveCostModel);
  
  // Pricing settings form
  document.getElementById('save-pricing').addEventListener('click', savePricingSettings);
  
  // Update pricing option visibility when pricing method changes
  document.getElementById('pricing-method').addEventListener('change', updatePricingOptionVisibility);
  
  // Dynamic cost/profit calculation for plates
  const plateGramsInput = document.getElementById('plate-grams');
  const plateTimeInput = document.getElementById('plate-time');
  const platePriceInput = document.getElementById('plate-price');
  const plateMaterialSelect = document.getElementById('plate-material');
  
  // Update cost calculation when cost model changes
  document.getElementById('cost-model-type').addEventListener('change', (e) => {
    updateTimeCostVisibility();
  });
  
  [plateGramsInput, plateTimeInput, platePriceInput, plateMaterialSelect].forEach(element => {
    if (element) {
      element.addEventListener('input', updatePlateCostProfit);
    }
  });
  
  // Report generation
  document.getElementById('generate-report-btn').addEventListener('click', generateReport);
  document.getElementById('export-csv-btn').addEventListener('click', exportReportToCsv);
  
  // Batch plate form
  document.getElementById('batch-add-plates-btn').addEventListener('click', openBatchPlateModal);
  document.getElementById('add-batch-entry').addEventListener('click', addBatchPlateEntry);
  document.getElementById('calculate-batch-prices').addEventListener('click', calculateBatchPrices);
  document.getElementById('save-batch-plates').addEventListener('click', saveBatchPlates);
  
  // Close batch plate modal on cancel
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('batch-plate-modal').style.display = 'none';
    });
  });
  
  // Update project pricing option visibility when pricing method changes
  const projectPricingMethod = document.getElementById('project-pricing-method');
  if (projectPricingMethod) {
    projectPricingMethod.addEventListener('change', updateProjectPricingVisibility);
  }
}

// Initialize filter event listeners
function initFilters() {
  const projectUserFilter = document.getElementById('project-user-filter');
  
  // Add event listener to filter projects by user
  projectUserFilter.addEventListener('change', () => {
    loadProjects(projectUserFilter.value || null);
  });
}

// DASHBOARD FUNCTIONS
async function loadDashboard() {
  try {
    // First ensure we have the latest settings
    await loadSettings();
    
    // Load stats
    const stats = await window.api.getStats();
    
    // Update stats on dashboard
    document.getElementById('total-plates').textContent = stats.total_plates || 0;
    document.getElementById('total-material').textContent = `${(stats.total_material_used || 0).toFixed(1)}g`;
    document.getElementById('total-sales').textContent = `$${(stats.total_sales || 0).toFixed(2)}`;
    document.getElementById('total-costs').textContent = `$${(stats.total_cost || 0).toFixed(2)}`;
    document.getElementById('total-profit').textContent = `$${(stats.total_profit || 0).toFixed(2)}`;
    
    // Check for low material alerts
    const materials = await window.api.getMaterials();
    const alertContainer = document.getElementById('material-alerts');
    alertContainer.innerHTML = '';
    
    const lowMaterials = materials.filter(material => material.quantity_remaining < 100);
    
    if (lowMaterials.length === 0) {
      alertContainer.innerHTML = '<p>No low material alerts.</p>';
    } else {
      lowMaterials.forEach(material => {
        const alert = document.createElement('div');
        alert.classList.add('alert');
        alert.textContent = `${material.name} (${material.color}) is low: ${material.quantity_remaining.toFixed(1)}g remaining`;
        alertContainer.appendChild(alert);
      });
    }
    
    // Update cost model settings in the UI
    document.getElementById('cost-model-type').value = settings.cost_model;
    document.getElementById('time-cost-rate').value = settings.time_cost_rate;
    updateTimeCostVisibility();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// USER FUNCTIONS
async function loadUsers() {
  try {
    users = await window.api.getUsers();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email || ''}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${user.id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${user.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('#users-table .edit-btn').forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-id');
        openUserModal(userId);
      });
    });
    
    document.querySelectorAll('#users-table .delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-id');
        deleteUser(userId);
      });
    });
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function openUserModal(userId = null) {
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  const title = document.getElementById('user-form-title');
  
  // Reset form
  form.reset();
  document.getElementById('user-id').value = '';
  
  if (userId) {
    // Edit mode
    title.textContent = 'Edit User';
    const user = users.find(u => u.id == userId);
    
    if (user) {
      document.getElementById('user-id').value = user.id;
      document.getElementById('user-name').value = user.name;
      document.getElementById('user-email').value = user.email || '';
    }
  } else {
    // Add mode
    title.textContent = 'Add User';
  }
  
  modal.style.display = 'block';
}

async function saveUser() {
  try {
    const userId = document.getElementById('user-id').value;
    const user = {
      name: document.getElementById('user-name').value,
      email: document.getElementById('user-email').value
    };
    
    if (userId) {
      // Update existing user
      user.id = parseInt(userId);
      await window.api.updateUser(user);
    } else {
      // Add new user
      await window.api.addUser(user);
    }
    
    // Close modal and refresh users
    document.getElementById('user-modal').style.display = 'none';
    loadUsers();
  } catch (error) {
    console.error('Error saving user:', error);
  }
}

async function deleteUser(userId) {
  if (confirm('Are you sure you want to delete this user? This will also delete all their projects and plates.')) {
    try {
      await window.api.deleteUser(userId);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }
}

// PROJECT FUNCTIONS
async function loadProjects(filterUserId = null) {
  try {
    // Load all users for the filter dropdown if not already loaded
    if (users.length === 0) {
      await loadUsers();
    }
    
    // Populate the user filter dropdown
    const projectUserFilter = document.getElementById('project-user-filter');
    
    // Clear previous options except 'All Users'
    while (projectUserFilter.options.length > 1) {
      projectUserFilter.remove(1);
    }
    
    // Add user options to filter dropdown
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.name;
      projectUserFilter.appendChild(option);
    });
    
    // If there's a filter value, set it
    if (filterUserId) {
      projectUserFilter.value = filterUserId;
    }
    
    // Load projects based on filter
    projects = await window.api.getProjects(filterUserId);
    const tbody = document.querySelector('#projects-table tbody');
    tbody.innerHTML = '';
    
    projects.forEach(project => {
      // Get a user-friendly name for the pricing method
      let pricingMethodName = 'Manual Pricing';
      switch (project.pricing_method) {
        case 'markup':
          pricingMethodName = `Markup (${project.markup_percentage}%)`;
          break;
        case 'fixed-gram':
          pricingMethodName = `Price per Gram ($${project.price_per_gram.toFixed(2)})`;
          break;
        case 'fixed-hour':
          pricingMethodName = `Price per Hour ($${project.price_per_hour.toFixed(2)})`;
          break;
      }
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${project.id}</td>
        <td>${project.user_name}</td>
        <td>${project.name}</td>
        <td>${project.description || ''}</td>
        <td>${pricingMethodName}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${project.id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${project.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('#projects-table .edit-btn').forEach(button => {
      button.addEventListener('click', () => {
        const projectId = button.getAttribute('data-id');
        openProjectModal(projectId);
      });
    });
    
    document.querySelectorAll('#projects-table .delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        const projectId = button.getAttribute('data-id');
        deleteProject(projectId);
      });
    });
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

async function openProjectModal(projectId = null) {
  const modal = document.getElementById('project-modal');
  const form = document.getElementById('project-form');
  const title = document.getElementById('project-form-title');
  const userSelect = document.getElementById('project-user');
  const projectUserFilter = document.getElementById('project-user-filter');
  
  // Reset form
  form.reset();
  document.getElementById('project-id').value = '';
  
  // Load users for dropdown
  userSelect.innerHTML = '';
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    userSelect.appendChild(option);
  });
  
  if (projectId) {
    // Edit mode
    title.textContent = 'Edit Project';
    const project = projects.find(p => p.id == projectId);
    
    if (project) {
      document.getElementById('project-id').value = project.id;
      document.getElementById('project-user').value = project.user_id;
      document.getElementById('project-name').value = project.name;
      document.getElementById('project-description').value = project.description || '';
      
      // Set pricing method values
      document.getElementById('project-pricing-method').value = project.pricing_method || 'none';
      document.getElementById('project-markup-percentage').value = project.markup_percentage || 50;
      document.getElementById('project-price-per-gram').value = project.price_per_gram || 0.10;
      document.getElementById('project-price-per-hour').value = project.price_per_hour || 20.00;
      
      // Update pricing options visibility
      updateProjectPricingVisibility();
    }
  } else {
    // Add mode
    title.textContent = 'Add Project';
    
    // If a user is selected in the filter, pre-select that user in the form
    const selectedUser = projectUserFilter.value;
    if (selectedUser) {
      userSelect.value = selectedUser;
    }
    
    // Set default pricing method to 'none'
    document.getElementById('project-pricing-method').value = 'none';
    updateProjectPricingVisibility();
  }
  
  modal.style.display = 'block';
}

async function saveProject() {
  try {
    const projectId = document.getElementById('project-id').value;
    const project = {
      user_id: parseInt(document.getElementById('project-user').value),
      name: document.getElementById('project-name').value,
      description: document.getElementById('project-description').value,
      pricing_method: document.getElementById('project-pricing-method').value,
      markup_percentage: parseInt(document.getElementById('project-markup-percentage').value),
      price_per_gram: parseFloat(document.getElementById('project-price-per-gram').value),
      price_per_hour: parseFloat(document.getElementById('project-price-per-hour').value)
    };
    
    if (projectId) {
      // Update existing project
      project.id = parseInt(projectId);
      await window.api.updateProject(project);
    } else {
      // Add new project
      await window.api.addProject(project);
    }
    
    // Close modal and refresh projects
    document.getElementById('project-modal').style.display = 'none';
    loadProjects();
  } catch (error) {
    console.error('Error saving project:', error);
  }
}

async function deleteProject(projectId) {
  if (confirm('Are you sure you want to delete this project? This will also delete all plates in this project.')) {
    try {
      await window.api.deleteProject(projectId);
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }
}

// MATERIAL FUNCTIONS
async function loadMaterials() {
  try {
    materials = await window.api.getMaterials();
    const tbody = document.querySelector('#materials-table tbody');
    tbody.innerHTML = '';
    
    materials.forEach(material => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${material.id}</td>
        <td>${material.name}</td>
        <td>${material.color || ''}</td>
        <td>$${material.cost_per_gram.toFixed(2)}</td>
        <td>${material.quantity_remaining.toFixed(1)}g</td>
        <td>
          <button class="action-btn edit-btn" data-id="${material.id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${material.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('#materials-table .edit-btn').forEach(button => {
      button.addEventListener('click', () => {
        const materialId = button.getAttribute('data-id');
        openMaterialModal(materialId);
      });
    });
    
    document.querySelectorAll('#materials-table .delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        const materialId = button.getAttribute('data-id');
        deleteMaterial(materialId);
      });
    });
  } catch (error) {
    console.error('Error loading materials:', error);
  }
}

function openMaterialModal(materialId = null) {
  const modal = document.getElementById('material-modal');
  const form = document.getElementById('material-form');
  const title = document.getElementById('material-form-title');
  
  // Reset form
  form.reset();
  document.getElementById('material-id').value = '';
  
  if (materialId) {
    // Edit mode
    title.textContent = 'Edit Material';
    const material = materials.find(m => m.id == materialId);
    
    if (material) {
      document.getElementById('material-id').value = material.id;
      document.getElementById('material-name').value = material.name;
      document.getElementById('material-color').value = material.color || '';
      document.getElementById('material-cost').value = material.cost_per_gram;
      document.getElementById('material-quantity').value = material.quantity_remaining;
    }
  } else {
    // Add mode
    title.textContent = 'Add Material';
  }
  
  modal.style.display = 'block';
}

async function saveMaterial() {
  try {
    const materialId = document.getElementById('material-id').value;
    const material = {
      name: document.getElementById('material-name').value,
      color: document.getElementById('material-color').value,
      cost_per_gram: parseFloat(document.getElementById('material-cost').value),
      quantity_remaining: parseFloat(document.getElementById('material-quantity').value)
    };
    
    if (materialId) {
      // Update existing material
      material.id = parseInt(materialId);
      await window.api.updateMaterial(material);
    } else {
      // Add new material
      await window.api.addMaterial(material);
    }
    
    // Close modal and refresh materials
    document.getElementById('material-modal').style.display = 'none';
    loadMaterials();
  } catch (error) {
    console.error('Error saving material:', error);
  }
}

async function deleteMaterial(materialId) {
  if (confirm('Are you sure you want to delete this material? This may affect existing plates.')) {
    try {
      await window.api.deleteMaterial(materialId);
      loadMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  }
}

// PLATE FUNCTIONS
async function loadPlates() {
  try {
    // Make sure we have the latest settings
    await loadSettings();
    
    plates = await window.api.getPlates();
    const tbody = document.querySelector('#plates-table tbody');
    tbody.innerHTML = '';
    
    plates.forEach(plate => {
      const row = document.createElement('tr');
      const date = new Date(plate.date);
      const formattedDate = date.toLocaleString();
      
      row.innerHTML = `
        <td>${plate.id}</td>
        <td>${plate.project_name}</td>
        <td>${plate.material_name} (${plate.color || 'N/A'})</td>
        <td>${plate.grams_used.toFixed(1)}g</td>
        <td>$${plate.price_sold.toFixed(2)}</td>
        <td>$${plate.cost.toFixed(2)}</td>
        <td>$${plate.profit.toFixed(2)}</td>
        <td>${formattedDate}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${plate.id}">Edit</button>
          <button class="action-btn delete-btn" data-id="${plate.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('#plates-table .edit-btn').forEach(button => {
      button.addEventListener('click', () => {
        const plateId = button.getAttribute('data-id');
        openPlateModal(plateId);
      });
    });
    
    document.querySelectorAll('#plates-table .delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        const plateId = button.getAttribute('data-id');
        deletePlate(plateId);
      });
    });
  } catch (error) {
    console.error('Error loading plates:', error);
  }
}

async function openPlateModal(plateId = null) {
  const modal = document.getElementById('plate-modal');
  const form = document.getElementById('plate-form');
  const title = document.getElementById('plate-form-title');
  const projectSelect = document.getElementById('plate-project');
  const materialSelect = document.getElementById('plate-material');
  
  // Reset form
  form.reset();
  document.getElementById('plate-id').value = '';
  document.getElementById('plate-material-cost').textContent = '$0.00';
  document.getElementById('plate-time-cost').textContent = '$0.00';
  document.getElementById('plate-cost').textContent = '$0.00';
  document.getElementById('plate-price').textContent = '$0.00';
  document.getElementById('plate-price-input').value = '0';
  document.getElementById('plate-profit').textContent = '$0.00';
  
  // Update time cost visibility based on cost model
  updateTimeCostVisibility();
  
  // Load projects for dropdown
  projectSelect.innerHTML = '';
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = `${project.name} (${project.user_name})`;
    projectSelect.appendChild(option);
  });
  
  // Load materials for dropdown
  materialSelect.innerHTML = '';
  materials.forEach(material => {
    const option = document.createElement('option');
    option.value = material.id;
    option.textContent = `${material.name} (${material.color || 'N/A'})`;
    option.setAttribute('data-cost', material.cost_per_gram);
    materialSelect.appendChild(option);
  });
  
  if (plateId) {
    // Edit mode
    title.textContent = 'Edit Plate';
    const plate = plates.find(p => p.id == plateId);
    
    if (plate) {
      document.getElementById('plate-id').value = plate.id;
      document.getElementById('plate-project').value = plate.project_id;
      document.getElementById('plate-material').value = plate.material_id;
      document.getElementById('plate-grams').value = plate.grams_used;
      document.getElementById('plate-time').value = plate.print_time || 0;
      document.getElementById('plate-price-input').value = plate.price_sold;
      
      // Format the date for datetime-local input
      const date = new Date(plate.date);
      const formattedDate = date.toISOString().slice(0, 16);
      document.getElementById('plate-date').value = formattedDate;
      
      // Update cost and profit displays
      updatePlateCostProfit();
    }
  } else {
    // Add mode
    title.textContent = 'Add Plate';
    // Set current date
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16);
    document.getElementById('plate-date').value = formattedDate;
  }
  
  modal.style.display = 'block';
  updatePlateCostProfit();
}

async function updatePlateCostProfit() {
  const grams = parseFloat(document.getElementById('plate-grams').value) || 0;
  const printTime = parseFloat(document.getElementById('plate-time').value) || 0;
  const projectId = document.getElementById('plate-project').value;
  const materialSelect = document.getElementById('plate-material');
  
  if (materialSelect.selectedIndex >= 0 && projectId) {
    const selectedOption = materialSelect.options[materialSelect.selectedIndex];
    const costPerGram = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
    
    const materialCost = grams * costPerGram;
    const timeCost = printTime * settings.time_cost_rate;
    
    // Calculate total cost based on cost model
    let totalCost = materialCost;
    if (settings.cost_model === 'max') {
      totalCost = Math.max(materialCost, timeCost);
    }
    
    // Calculate price based on project's pricing method
    const { sellingPrice } = await calculateSellingPrice(grams, printTime, costPerGram, projectId);
    
    const profit = sellingPrice - totalCost;
    
    // Update UI
    document.getElementById('plate-material-cost').textContent = `$${materialCost.toFixed(2)}`;
    document.getElementById('plate-time-cost').textContent = `$${timeCost.toFixed(2)}`;
    document.getElementById('plate-cost').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('plate-price').textContent = `$${sellingPrice.toFixed(2)}`;
    document.getElementById('plate-price-input').value = sellingPrice;
    document.getElementById('plate-profit').textContent = `$${profit.toFixed(2)}`;
  }
}

async function savePlate() {
  try {
    const plateId = document.getElementById('plate-id').value;
    const plate = {
      project_id: parseInt(document.getElementById('plate-project').value),
      material_id: parseInt(document.getElementById('plate-material').value),
      grams_used: parseFloat(document.getElementById('plate-grams').value),
      print_time: parseFloat(document.getElementById('plate-time').value) || 0,
      price_sold: parseFloat(document.getElementById('plate-price-input').value),
      date: document.getElementById('plate-date').value
    };
    
    if (plateId) {
      // Update existing plate
      plate.id = parseInt(plateId);
      await window.api.updatePlate(plate);
    } else {
      // Add new plate
      await window.api.addPlate(plate);
    }
    
    // Close modal and refresh plates
    document.getElementById('plate-modal').style.display = 'none';
    loadPlates();
    loadMaterials(); // Refresh materials as inventory is updated
    
    // Also refresh dashboard if we're adding plates
    if (currentView === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    console.error('Error saving plate:', error);
  }
}

async function deletePlate(plateId) {
  if (confirm('Are you sure you want to delete this plate?')) {
    try {
      await window.api.deletePlate(plateId);
      loadPlates();
      loadMaterials(); // Refresh materials as inventory is updated
      
      // Also refresh dashboard if we're deleting plates
      if (currentView === 'dashboard') {
        loadDashboard();
      }
    } catch (error) {
      console.error('Error deleting plate:', error);
    }
  }
}

// REPORT FUNCTIONS
async function loadReportUserOptions() {
  const userSelect = document.getElementById('report-user');
  
  // Clear previous options except 'All Users'
  while (userSelect.options.length > 1) {
    userSelect.remove(1);
  }
  
  // Add user options
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    userSelect.appendChild(option);
  });
}

async function generateReport() {
  try {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    const userId = document.getElementById('report-user').value;
    
    let data;
    if (userId) {
      // Get user-specific stats
      data = await window.api.getUserStats(userId, startDate, endDate);
    } else {
      // Get overall stats
      data = await window.api.getStats(startDate, endDate);
    }
    
    // Display report results
    const reportResults = document.getElementById('report-results');
    reportResults.innerHTML = '';
    
    // Create summary section
    const summary = document.createElement('div');
    summary.innerHTML = `
      <h3>Summary Report</h3>
      <p><strong>Period:</strong> ${startDate || 'All time'} ${endDate ? `to ${endDate}` : ''}</p>
      <p><strong>User:</strong> ${userId ? users.find(u => u.id == userId).name : 'All Users'}</p>
      <div class="report-stats">
        <p><strong>Total Plates:</strong> ${data.total_plates || 0}</p>
        <p><strong>Total Material Used:</strong> ${(data.total_material_used || 0).toFixed(1)}g</p>
        <p><strong>Total Sales:</strong> $${(data.total_sales || 0).toFixed(2)}</p>
        <p><strong>Total Costs:</strong> $${(data.total_cost || 0).toFixed(2)}</p>
        <p><strong>Total Profit:</strong> $${(data.total_profit || 0).toFixed(2)}</p>
      </div>
    `;
    reportResults.appendChild(summary);
    
    // Get detailed plate data for the report
    let plateData;
    if (userId) {
      // Get plates for specific user
      const userProjects = await window.api.getProjects(userId);
      plateData = [];
      
      for (const project of userProjects) {
        const projectPlates = await window.api.getPlates(project.id);
        plateData = plateData.concat(projectPlates);
      }
      
      // Filter by date if provided
      if (startDate && endDate) {
        plateData = plateData.filter(plate => {
          const plateDate = new Date(plate.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1); // Include end date
          
          return plateDate >= start && plateDate <= end;
        });
      }
    } else {
      // Get all plates
      plateData = await window.api.getPlates();
      
      // Filter by date if provided
      if (startDate && endDate) {
        plateData = plateData.filter(plate => {
          const plateDate = new Date(plate.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1); // Include end date
          
          return plateDate >= start && plateDate <= end;
        });
      }
    }
    
    // Create detailed table if there are plates
    if (plateData.length > 0) {
      const detailSection = document.createElement('div');
      detailSection.innerHTML = `
        <h3>Detailed Plates</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Project</th>
              <th>Material</th>
              <th>Grams</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${plateData.map(plate => {
              const date = new Date(plate.date);
              return `
                <tr>
                  <td>${plate.id}</td>
                  <td>${date.toLocaleDateString()}</td>
                  <td>${plate.project_name}</td>
                  <td>${plate.material_name}</td>
                  <td>${plate.grams_used.toFixed(1)}g</td>
                  <td>$${plate.price_sold.toFixed(2)}</td>
                  <td>$${plate.cost.toFixed(2)}</td>
                  <td>$${plate.profit.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      reportResults.appendChild(detailSection);
    }
  } catch (error) {
    console.error('Error generating report:', error);
  }
}

async function exportReportToCsv() {
  try {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    const userId = document.getElementById('report-user').value;
    
    // Get plate data for export
    let plateData;
    if (userId) {
      // Get plates for specific user
      const userProjects = await window.api.getProjects(userId);
      plateData = [];
      
      for (const project of userProjects) {
        const projectPlates = await window.api.getPlates(project.id);
        plateData = plateData.concat(projectPlates);
      }
    } else {
      // Get all plates
      plateData = await window.api.getPlates();
    }
    
    // Filter by date if provided
    if (startDate && endDate) {
      plateData = plateData.filter(plate => {
        const plateDate = new Date(plate.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Include end date
        
        return plateDate >= start && plateDate <= end;
      });
    }
    
    // Convert to CSV
    const headers = ['ID', 'Date', 'User', 'Project', 'Material', 'Grams Used', 'Price Sold', 'Cost', 'Profit'];
    const rows = plateData.map(plate => {
      const date = new Date(plate.date).toLocaleDateString();
      return [
        plate.id,
        date,
        plate.user_name,
        plate.project_name,
        plate.material_name,
        plate.grams_used.toFixed(1),
        plate.price_sold.toFixed(2),
        plate.cost.toFixed(2),
        plate.profit.toFixed(2)
      ];
    });
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    // Calculate total summary row
    const totalGrams = plateData.reduce((sum, plate) => sum + plate.grams_used, 0);
    const totalPrice = plateData.reduce((sum, plate) => sum + plate.price_sold, 0);
    const totalCost = plateData.reduce((sum, plate) => sum + plate.cost, 0);
    const totalProfit = plateData.reduce((sum, plate) => sum + plate.profit, 0);
    
    csvContent += `\nTotals,,,,${totalGrams.toFixed(1)},${totalPrice.toFixed(2)},${totalCost.toFixed(2)},${totalProfit.toFixed(2)}`;
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const reportName = userId 
      ? `${users.find(u => u.id == userId).name}_report_${startDate || 'alltime'}.csv`
      : `studio_report_${startDate || 'alltime'}.csv`;
    
    a.href = url;
    a.download = reportName;
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting report:', error);
  }
}

// Save cost model settings
async function saveCostModel() {
  try {
    const costModelType = document.getElementById('cost-model-type').value;
    const timeCostRate = parseFloat(document.getElementById('time-cost-rate').value);
    
    // Update settings object
    settings.cost_model = costModelType;
    settings.time_cost_rate = timeCostRate;
    
    // Save to database
    await window.api.updateSetting('cost_model', costModelType);
    await window.api.updateSetting('time_cost_rate', timeCostRate.toString());
    
    // Update UI
    updateTimeCostVisibility();
    updateBatchTimeCostVisibility(); // Update batch plate UI as well
    
    // Refresh data that depends on cost calculations
    if (currentView === 'dashboard') {
      loadDashboard();
    } else if (currentView === 'plates') {
      loadPlates();
    }
    
    alert('Cost model settings saved successfully.');
  } catch (error) {
    console.error('Error saving cost model settings:', error);
    alert('Failed to save cost model settings.');
  }
}

// Save pricing settings
async function savePricingSettings() {
  try {
    const pricingMethod = document.getElementById('pricing-method').value;
    const markupPercentage = parseInt(document.getElementById('markup-percentage').value);
    const pricePerGram = parseFloat(document.getElementById('price-per-gram').value);
    const pricePerHour = parseFloat(document.getElementById('price-per-hour').value);
    
    // Update settings object
    settings.pricing_method = pricingMethod;
    settings.markup_percentage = markupPercentage;
    settings.price_per_gram = pricePerGram;
    settings.price_per_hour = pricePerHour;
    
    // Save to database
    await window.api.updateSetting('pricing_method', pricingMethod);
    await window.api.updateSetting('markup_percentage', markupPercentage.toString());
    await window.api.updateSetting('price_per_gram', pricePerGram.toString());
    await window.api.updateSetting('price_per_hour', pricePerHour.toString());
    
    // Update UI
    updatePricingOptionVisibility();
    
    alert('Pricing settings saved successfully.');
  } catch (error) {
    console.error('Error saving pricing settings:', error);
    alert('Failed to save pricing settings.');
  }
}

// Calculate selling price based on pricing settings
async function calculateSellingPrice(grams, printTime, costPerGram, projectId) {
  const materialCost = grams * costPerGram;
  const timeCost = printTime * settings.time_cost_rate;
  
  // Calculate total cost based on cost model
  let totalCost = materialCost;
  if (settings.cost_model === 'max') {
    totalCost = Math.max(materialCost, timeCost);
  }
  
  // Get project-specific pricing if a project ID is provided
  let pricingMethod = settings.pricing_method;
  let markupPercentage = settings.markup_percentage;
  let pricePerGram = settings.price_per_gram;
  let pricePerHour = settings.price_per_hour;
  
  if (projectId) {
    try {
      const projectPricing = await window.api.getProjectPricing(projectId);
      if (projectPricing) {
        pricingMethod = projectPricing.pricing_method;
        markupPercentage = projectPricing.markup_percentage;
        pricePerGram = projectPricing.price_per_gram;
        pricePerHour = projectPricing.price_per_hour;
      }
    } catch (error) {
      console.error('Error getting project pricing:', error);
      // If there's an error, fall back to global settings
    }
  }
  
  // Calculate selling price based on pricing method
  let sellingPrice = 0;
  
  switch (pricingMethod) {
    case 'markup':
      sellingPrice = totalCost * (1 + markupPercentage / 100);
      break;
    case 'fixed-gram':
      sellingPrice = grams * pricePerGram;
      break;
    case 'fixed-hour':
      if (printTime > 0) {
        sellingPrice = printTime * pricePerHour;
      } else {
        // Fallback to markup if print time is not available
        sellingPrice = totalCost * (1 + markupPercentage / 100);
      }
      break;
    default:
      // For 'none' method, leave it at 0 for user to input manually
      sellingPrice = 0;
  }
  
  return {
    materialCost,
    timeCost,
    totalCost,
    sellingPrice: parseFloat(sellingPrice.toFixed(2))
  };
}

// Function to open the batch plate modal
async function openBatchPlateModal() {
  const modal = document.getElementById('batch-plate-modal');
  const projectSelect = document.getElementById('batch-plate-project');
  const materialSelect = document.getElementById('batch-plate-material');
  
  // Clear previous entries except for the first one
  const batchContainer = document.getElementById('batch-plates-container');
  batchContainer.innerHTML = '';
  addBatchPlateEntry(); // Add the first entry
  
  // Update time cost visibility based on cost model
  updateBatchTimeCostVisibility();
  
  // Load projects for dropdown
  projectSelect.innerHTML = '';
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = `${project.name} (${project.user_name})`;
    projectSelect.appendChild(option);
  });
  
  // Load materials for dropdown
  materialSelect.innerHTML = '';
  materials.forEach(material => {
    const option = document.createElement('option');
    option.value = material.id;
    option.textContent = `${material.name} (${material.color || 'N/A'})`;
    option.setAttribute('data-cost', material.cost_per_gram);
    materialSelect.appendChild(option);
  });
  
  modal.style.display = 'block';
}

// Function to add a new batch plate entry
function addBatchPlateEntry() {
  const batchContainer = document.getElementById('batch-plates-container');
  const entryCount = batchContainer.querySelectorAll('.batch-plate-entry').length;
  
  const newEntry = document.createElement('div');
  newEntry.className = 'batch-plate-entry';
  
  // Set the current date
  const now = new Date();
  const formattedDate = now.toISOString().slice(0, 16);
  
  newEntry.innerHTML = `
    ${entryCount > 0 ? '<span class="remove-batch-entry">&times;</span>' : ''}
    <div class="form-group">
      <label>Material Used (grams)</label>
      <input type="number" class="batch-plate-grams" step="0.1" min="0" required>
    </div>
    <div class="form-group batch-plate-time-container" ${settings.cost_model !== 'max' ? 'style="display:none;"' : ''}>
      <label>Print Time (hours)</label>
      <input type="number" class="batch-plate-time" step="0.1" min="0">
    </div>
    <div class="form-group">
      <label>Date</label>
      <input type="datetime-local" class="batch-plate-date" required value="${formattedDate}">
    </div>
  `;
  
  batchContainer.appendChild(newEntry);
  
  // Add event listener to the remove button
  const removeBtn = newEntry.querySelector('.remove-batch-entry');
  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      batchContainer.removeChild(newEntry);
    });
  }
}

// Function to update time cost visibility for batch entries
function updateBatchTimeCostVisibility() {
  const isMaxCostModel = settings.cost_model === 'max';
  const timeContainers = document.querySelectorAll('.batch-plate-time-container');
  
  timeContainers.forEach(container => {
    container.style.display = isMaxCostModel ? 'block' : 'none';
  });
}

// Function to calculate prices for all batch entries and show preview
async function calculateBatchPrices() {
  const projectId = document.getElementById('batch-plate-project').value;
  const materialId = document.getElementById('batch-plate-material').value;
  const materialSelect = document.getElementById('batch-plate-material');
  
  if (!materialId || materialSelect.selectedIndex < 0 || !projectId) {
    alert('Please select both a project and material first.');
    return;
  }
  
  const selectedOption = materialSelect.options[materialSelect.selectedIndex];
  const costPerGram = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
  
  // Get all batch entries
  const entries = document.querySelectorAll('.batch-plate-entry');
  
  // Create price preview
  const previewContainer = document.getElementById('batch-price-preview');
  previewContainer.innerHTML = '<h3>Price Preview</h3>';
  
  let totalMaterialCost = 0;
  let totalTimeCost = 0;
  let totalPrice = 0;
  let totalProfit = 0;
  
  const previewTable = document.createElement('table');
  previewTable.className = 'data-table';
  previewTable.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Grams</th>
        <th>Material Cost</th>
        ${settings.cost_model === 'max' ? '<th>Print Time</th><th>Time Cost</th>' : ''}
        <th>Total Cost</th>
        <th>Price</th>
        <th>Profit</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tableBody = previewTable.querySelector('tbody');
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const gramsInput = entry.querySelector('.batch-plate-grams');
    const timeInput = entry.querySelector('.batch-plate-time');
    
    const grams = parseFloat(gramsInput.value) || 0;
    const printTime = parseFloat(timeInput?.value) || 0;
    
    if (grams > 0) {
      const { materialCost, timeCost, totalCost, sellingPrice } = await calculateSellingPrice(grams, printTime, costPerGram, projectId);
      const profit = sellingPrice - totalCost;
      
      totalMaterialCost += materialCost;
      totalTimeCost += timeCost;
      totalPrice += sellingPrice;
      totalProfit += profit;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${i + 1}</td>
        <td>${grams.toFixed(1)}g</td>
        <td>$${materialCost.toFixed(2)}</td>
        ${settings.cost_model === 'max' ? `<td>${printTime.toFixed(1)}hr</td><td>$${timeCost.toFixed(2)}</td>` : ''}
        <td>$${totalCost.toFixed(2)}</td>
        <td>$${sellingPrice.toFixed(2)}</td>
        <td>$${profit.toFixed(2)}</td>
      `;
      
      tableBody.appendChild(row);
    }
  }
  
  // Add total row
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  totalRow.innerHTML = `
    <td><strong>Total</strong></td>
    <td></td>
    <td><strong>$${totalMaterialCost.toFixed(2)}</strong></td>
    ${settings.cost_model === 'max' ? '<td></td><td><strong>$' + totalTimeCost.toFixed(2) + '</strong></td>' : ''}
    <td><strong>$${(totalMaterialCost + (settings.cost_model === 'max' ? totalTimeCost : 0)).toFixed(2)}</strong></td>
    <td><strong>$${totalPrice.toFixed(2)}</strong></td>
    <td><strong>$${totalProfit.toFixed(2)}</strong></td>
  `;
  
  tableBody.appendChild(totalRow);
  previewContainer.appendChild(previewTable);
}

// Function to save all batch plates
async function saveBatchPlates() {
  try {
    const projectId = parseInt(document.getElementById('batch-plate-project').value);
    const materialId = parseInt(document.getElementById('batch-plate-material').value);
    
    if (!projectId || !materialId) {
      alert('Please select both a project and material.');
      return;
    }
    
    // Get all batch entries
    const entries = document.querySelectorAll('.batch-plate-entry');
    let hasErrors = false;
    
    // Validate all entries
    entries.forEach(entry => {
      const gramsInput = entry.querySelector('.batch-plate-grams');
      const dateInput = entry.querySelector('.batch-plate-date');
      
      if (!gramsInput.value || !dateInput.value) {
        hasErrors = true;
      }
    });
    
    if (hasErrors) {
      alert('Please fill out all required fields for every plate.');
      return;
    }
    
    // Get material cost per gram
    const materialSelect = document.getElementById('batch-plate-material');
    const selectedOption = materialSelect.options[materialSelect.selectedIndex];
    const costPerGram = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
    
    // Create an array of plate objects
    const batchPlates = [];
    
    for (const entry of entries) {
      const grams = parseFloat(entry.querySelector('.batch-plate-grams').value);
      const printTime = parseFloat(entry.querySelector('.batch-plate-time')?.value) || 0;
      const date = entry.querySelector('.batch-plate-date').value;
      
      // Calculate price based on project's pricing method
      const { sellingPrice } = await calculateSellingPrice(grams, printTime, costPerGram, projectId);
      
      batchPlates.push({
        project_id: projectId,
        material_id: materialId,
        grams_used: grams,
        print_time: printTime,
        price_sold: sellingPrice,
        date: date
      });
    }
    
    // Save each plate
    for (const plate of batchPlates) {
      await window.api.addPlate(plate);
    }
    
    // Close modal and refresh plates
    document.getElementById('batch-plate-modal').style.display = 'none';
    loadPlates();
    loadMaterials(); // Refresh materials as inventory is updated
    
    // Also refresh dashboard
    if (currentView === 'dashboard') {
      loadDashboard();
    }
    
    alert(`Successfully added ${batchPlates.length} plates.`);
  } catch (error) {
    console.error('Error saving batch plates:', error);
    alert('Error saving batch plates. See console for details.');
  }
}

// Function to show/hide project pricing options based on selected method
function updateProjectPricingVisibility() {
  const pricingMethod = document.getElementById('project-pricing-method').value;
  
  // Hide all pricing options first
  document.querySelectorAll('.project-pricing-option').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show only the relevant option based on the selected method
  if (pricingMethod === 'markup') {
    document.getElementById('project-markup-container').style.display = 'block';
  } else if (pricingMethod === 'fixed-gram') {
    document.getElementById('project-price-per-gram-container').style.display = 'block';
  } else if (pricingMethod === 'fixed-hour') {
    document.getElementById('project-price-per-hour-container').style.display = 'block';
  }
} 