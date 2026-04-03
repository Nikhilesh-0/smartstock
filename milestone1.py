
import sqlite3

class Product:
    def __init__(self, name, category, price, supplier, stock, reorder_level):
        self.name = name
        self.category = category
        self.price = price
        self.supplier = supplier
        self.stock = stock
        self.reorder_level = reorder_level

class Inventory:
    def __init__(self):
        self.conn = sqlite3.connect("inventory.db")
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT,
                category TEXT,
                price REAL,
                supplier TEXT,
                stock INTEGER,
                reorder_level INTEGER
            )
        """)
        self.conn.commit()

    def add_product(self):
        name = input("Product Name: ")
        category = input("Category: ")
        price = float(input("Price: "))
        supplier = input("Supplier: ")
        stock = int(input("Stock Quantity: "))
        reorder = int(input("Reorder Level: "))
        
        new_product = Product(name, category, price, supplier, stock, reorder)
        
        self.cursor.execute("""
            INSERT INTO products (name, category, price, supplier, stock, reorder_level) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (new_product.name, new_product.category, new_product.price, new_product.supplier, new_product.stock, new_product.reorder_level))
        self.conn.commit()
        print("Product added successfully!")

    def view_products(self):
        self.cursor.execute("SELECT * FROM products")
        rows = self.cursor.fetchall()
        print("Inventory List")
        if not rows:
            print("No products available.")
        for row in rows:
            print(row)
        print()

    def update_stock(self):
        pid = int(input("Enter Product ID: "))
        new_stock = int(input("New Stock Quantity: "))
        self.cursor.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, pid))
        self.conn.commit()
        print("Stock updated!")

    def delete_product(self):
        pid = int(input("Enter Product ID to delete: "))
        self.cursor.execute("DELETE FROM products WHERE id = ?", (pid,))
        self.conn.commit()
        print("Product deleted")
        
    def close_system(self):
        self.conn.close()

inventory = Inventory()

while True:
    print("SMART INVENTORY SYSTEM")
    print("1. Add Product")
    print("2. View Products")
    print("3. Update Stock")
    print("4. Delete Product")
    print("5. Exit")
    
    choice = input("Enter choice: ")
    
    if choice == "1":
        inventory.add_product()
    elif choice == "2":
        inventory.view_products()
    elif choice == "3":
        inventory.update_stock()
    elif choice == "4":
        inventory.delete_product()
    elif choice == "5":
        inventory.close_system()
        print("Exiting system")
        break
    else:
        print("Invalid choice")
