# 3D Printing ERM System (Lightweight Edition)

A local database-driven ERM (Enterprise Resource Management) system specifically designed for small 3D printing studios. This application helps track filament inventory, manage projects per user, calculate costs and profits per print plate, and summarize studio performance.

## Features

- **User Management:** Assign and group print jobs under users
- **Project & Plate Tracking:** Each user can have multiple projects, each with multiple plates
- **Cost Calculation:** Automatically calculate cost of a print plate based on filament usage
- **Profit Tracking:** Record sale price and compute profit for each plate
- **Inventory Tracking:** Track available filament by type, material, and remaining quantity
- **Performance Summary:** Generate reports on total profits, costs, and plate counts

## Technology Stack

- **Frontend:** ElectronJS
- **Database:** SQLite (local, file-based storage)
- **Languages:** JavaScript, HTML, CSS

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/spaaarkERM.git
   cd spaaarkERM
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

## Database Schema

The application uses a SQLite database with the following tables:

- **Users:** Stores user information
- **Projects:** Tracks projects assigned to users
- **Materials:** Manages the inventory of printing materials
- **Plates:** Records print plates with cost and profit calculations

## Usage

### Dashboard
View key statistics at a glance, including total plates, material used, sales, costs, and profits. Material alerts for low inventory are also displayed here.

### User Management
Add, edit, and remove users who will be associated with projects and plates.

### Project Management
Create and manage projects, assigning them to specific users.

### Plate Tracking
Record each print plate with details about the material used, grams consumed, and selling price. The system automatically calculates costs and profits.

### Material Inventory
Track your filament inventory, including material type, color, cost per gram, and remaining quantity.

### Reports
Generate detailed reports on studio performance, with filtering options by date range and user. Export reports to CSV for external analysis.

## Development

This is a standalone desktop application built with Electron and a SQLite database. All data is stored locally, with no online dependencies.

## Future Considerations

- Barcode-based plate tracking
- Optional cloud sync
- Mobile app companion for quick job logging 