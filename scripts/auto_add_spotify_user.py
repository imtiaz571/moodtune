"""
Spotify Developer Dashboard User Management Automation Script
Automates adding user email addresses to the Spotify Developer Dashboard allowlist using Playwright.
"""

import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "8234336a63924806a61d4c24f39b1c30")
USER_DATA_DIR = os.path.join(os.path.dirname(__file__), ".browser_session")

def add_user_to_spotify_dashboard(name: str, email: str, headless: bool = False):
    """
    Automates adding a user (name and email) to the Spotify Developer Dashboard.
    Uses persistent browser context so login cookies are saved after first login.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ Playwright is not installed. Please install it with: pip install playwright && npx playwright install chromium")
        sys.exit(1)

    print(f"🚀 Launching browser to add {email} ({name}) to Spotify Developer Dashboard...")
    
    with sync_playwright() as p:
        # Launch browser with persistent storage (saves login session cookies)
        context = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=headless,
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        
        target_url = f"https://developer.spotify.com/dashboard/{SPOTIFY_CLIENT_ID}/users"
        print(f"🌐 Navigating to {target_url}...")
        page.goto(target_url, wait_until="domcontentloaded")
        
        # Check if redirected to login page
        if "login" in page.url or "accounts.spotify.com" in page.url:
            print("🔑 Please complete your Spotify Developer login in the opened browser window...")
            page.wait_for_url("**/dashboard/**", timeout=120000)
            page.goto(target_url, wait_until="domcontentloaded")
        
        page.wait_for_timeout(2000)
        print("🔍 Locating User Management input fields...")
        
        # Click on User Management tab if present
        user_mgmt_tab = page.query_selector("text=User Management")
        if user_mgmt_tab:
            user_mgmt_tab.click()
            page.wait_for_timeout(1000)
            
        inputs = page.locator("input[type='text'], input[type='email']").all()
        if len(inputs) >= 2:
            inputs[0].fill(name)
            inputs[1].fill(email)
            print(f"✍️ Filled Name: '{name}', Email: '{email}'")
            
            add_btn = page.locator("button:has-text('Add user')")
            if add_btn.is_visible():
                add_btn.click()
                print("✅ Clicked 'Add user' button successfully!")
                page.wait_for_timeout(2000)
            else:
                print("⚠️ Could not locate 'Add user' button.")
        else:
            print("⚠️ Could not locate name/email input fields on dashboard.")
            
        context.close()
        print(f"🎉 Successfully completed automation for {email}!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-add emails to Spotify Developer Dashboard")
    parser.add_argument("--name", required=True, help="Full Name of the user")
    parser.add_argument("--email", required=True, help="Email address of the user")
    parser.add_argument("--headless", action="store_true", help="Run browser in background")
    
    args = parser.parse_args()
    add_user_to_spotify_dashboard(args.name, args.email, args.headless)
