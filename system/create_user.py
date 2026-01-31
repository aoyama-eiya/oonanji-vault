from passlib.context import CryptContext
import sqlite3

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("password123")

conn = sqlite3.connect("users.db")
c = conn.cursor()
try:
    c.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ("debuguser", hashed, "admin"))
    conn.commit()
    print("User created")
except Exception as e:
    print(f"Error: {e}")
conn.close()
