"""
Playwright E2E Test: Complete game simulation for 菜根人生 (Nannaricher)
Simulates 2 players through a complete game until victory.
Takes screenshots at key milestones to verify UI quality.

Updated for the new training plan system:
- No more setup_plans phase (game starts directly in playing)
- Yearly plan selection happens via choose_option dialogs
- Plans use majorPlan/minorPlans model
"""

import time
import os
from playwright.sync_api import sync_playwright, Page

BASE_URL = "http://localhost:3001"
SCREENSHOT_DIR = "balance-test/screenshots"
MAX_GAME_SECONDS = 600  # 10 min max

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

shot_counter = [0]

def shot(page: Page, name: str):
    """Take a numbered screenshot."""
    shot_counter[0] += 1
    path = f"{SCREENSHOT_DIR}/{shot_counter[0]:03d}-{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"  [Screenshot] {path}")


def dismiss_overlays(page: Page) -> bool:
    """Dismiss any tutorial or blocking overlay. Returns True if something was dismissed."""
    dismissed = False

    # Tutorial overlay - "跳过全部" (skip all)
    try:
        skip = page.locator("text=跳过全部")
        if skip.count() > 0 and skip.first.is_visible():
            skip.first.click(force=True)
            page.wait_for_timeout(400)
            dismissed = True
            print("    [Overlay] Dismissed tutorial (skip all)")
    except:
        pass

    # Tutorial overlay - "知道了" (got it)
    try:
        got_it = page.locator("text=知道了")
        if got_it.count() > 0 and got_it.first.is_visible():
            got_it.first.click(force=True)
            page.wait_for_timeout(400)
            dismissed = True
            print("    [Overlay] Dismissed tutorial step (got it)")
    except:
        pass

    return dismissed


def dismiss_all_overlays(page: Page):
    """Keep dismissing overlays until none remain."""
    for _ in range(10):
        if not dismiss_overlays(page):
            break
        page.wait_for_timeout(200)


def try_click_any(page: Page, selectors: list[str], force: bool = False) -> str | None:
    """Try clicking the first visible element matching any selector. Returns matched selector or None."""
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(force=force, timeout=3000)
                return sel
        except:
            pass
    return None


def get_visible_text(page: Page, selector: str) -> str:
    """Get text content of first visible element or empty string."""
    try:
        loc = page.locator(selector)
        if loc.count() > 0 and loc.first.is_visible():
            return loc.first.inner_text()
    except:
        pass
    return ""


def bypass_auth(page: Page, player_name: str):
    """Inject mock auth tokens into localStorage to bypass login screen."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    import json, base64, math, time as _time
    user_id = f"test-{int(_time.time() * 1000)}"
    mock_user = json.dumps({"userId": user_id, "username": player_name, "nickname": player_name})
    # Build a minimal JWT-shaped token (header.payload.signature)
    header = base64.b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    now = int(_time.time())
    payload_obj = {"sub": user_id, "iat": now, "exp": now + 86400}
    payload = base64.b64encode(json.dumps(payload_obj).encode()).decode().rstrip("=")
    mock_token = f"{header}.{payload}.mock"
    page.evaluate(f"""() => {{
        localStorage.setItem('nannaricher_access_token', '{mock_token}');
        localStorage.setItem('nannaricher_refresh_token', 'mock-refresh');
        localStorage.setItem('nannaricher_user', {json.dumps(mock_user)});
    }}""")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def create_room(page: Page, player_name: str) -> str:
    """Player creates a room. Returns room code."""
    bypass_auth(page, player_name)
    shot(page, "lobby")

    page.click(".lobby-button.create")
    page.wait_for_timeout(500)

    # Name field should be pre-filled from auth, but fill to be safe
    name_input = page.locator("input#playerName")
    if name_input.count() > 0 and name_input.first.is_visible():
        name_input.fill(player_name)
    page.wait_for_timeout(200)

    # Select 1 dice
    dice = page.locator(".dice-option")
    if dice.count() > 0:
        dice.first.click()

    page.click(".submit-button")
    page.wait_for_timeout(2000)
    shot(page, "waiting-room-host")

    code = page.locator(".room-code").inner_text().strip()
    print(f"  Room created: {code}")
    return code


def join_room(page: Page, room_code: str, player_name: str):
    """Player joins an existing room."""
    bypass_auth(page, player_name)

    page.click(".lobby-button.join")
    page.wait_for_timeout(500)

    page.fill("input#roomCode", room_code)
    # Name field should be pre-filled from auth, but fill to be safe
    name_input = page.locator("input#playerName")
    if name_input.count() > 0 and name_input.first.is_visible():
        name_input.fill(player_name)
    page.wait_for_timeout(200)

    dice = page.locator(".dice-option")
    if dice.count() > 0:
        dice.first.click()

    page.click(".submit-button")
    page.wait_for_timeout(2000)
    shot(page, "waiting-room-joined")
    print(f"  {player_name} joined room {room_code}")


def start_game(page: Page):
    """Host starts the game."""
    btn = page.locator(".start-button")
    btn.wait_for(state="visible", timeout=10000)
    shot(page, "before-start")
    btn.click()
    page.wait_for_timeout(2000)
    print("  Game started!")


def handle_action(page: Page, player_name: str) -> str:
    """Try to handle one pending action. Returns action type or ''."""

    # Always try dismissing overlays first
    dismiss_overlays(page)

    # 1. Multi-select dialog (yearly plan selection, plan overflow, etc.)
    multi = page.locator(".choice-dialog.multi-select")
    if multi.count() > 0 and multi.first.is_visible():
        # Click first unselected option
        opts = multi.locator(".option-button:not(.selected):not(.disabled)")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(300)
        # Try confirm button (may need min selections met)
        cfm = multi.locator(".confirm-button:not([disabled])")
        if cfm.count() > 0:
            try:
                cfm.first.click(force=True, timeout=2000)
                page.wait_for_timeout(600)
                return "multi_select"
            except:
                pass
        # If confirm still disabled, try selecting more options
        opts2 = multi.locator(".option-button:not(.selected):not(.disabled)")
        if opts2.count() > 0:
            opts2.first.click(force=True)
            page.wait_for_timeout(200)
        return "multi_select_partial"

    # 2. Single-select choice dialog (.choice-dialog but NOT multi-select)
    choice = page.locator(".choice-dialog:not(.multi-select)")
    if choice.count() > 0 and choice.first.is_visible():
        opts = choice.locator(".option-button")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(1000)
            return "choice_dialog"

    # 3. Event modal with options
    event = page.locator(".event-modal.has-options")
    if event.count() > 0 and event.first.is_visible():
        opts = event.locator(".option-button")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(500)
            # Click confirm if present
            cfm = event.locator(".confirm-button")
            if cfm.count() > 0:
                cfm.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_choice"

    # 4. Event modal without options — click the confirm button or overlay
    event_ro = page.locator(".event-modal:not(.has-options)")
    if event_ro.count() > 0 and event_ro.first.is_visible():
        # Click the "确定" confirm button inside the modal footer
        cfm = event_ro.locator(".confirm-button")
        if cfm.count() > 0 and cfm.first.is_visible():
            cfm.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_confirm"
        # Fallback: click the overlay background to dismiss
        overlay = page.locator(".event-modal-overlay:not(.read-only)")
        if overlay.count() > 0:
            # Click at the edge of the overlay (outside the modal)
            overlay.first.click(force=True, position={"x": 10, "y": 10})
            page.wait_for_timeout(800)
            return "event_overlay_dismiss"

    # 5. Vote panel (multi-vote)
    vote = page.locator(".vote-panel__overlay")
    if vote.count() > 0 and vote.first.is_visible():
        opts = vote.locator(".vote-panel__option-btn:not(.vote-panel__option-btn--selected):not(.vote-panel__option-btn--dimmed):not([disabled])")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(800)
            return "vote"

    # 6. Dice button (desktop) — check text carefully
    dice_btn = page.locator(".action-bar__dice-btn")
    if dice_btn.count() > 0 and dice_btn.first.is_visible():
        txt = get_visible_text(page, ".action-bar__dice-btn")
        if ("掷骰子" in txt or "投骰" in txt) and "等待" not in txt and "中..." not in txt:
            dice_btn.first.click(force=True)
            page.wait_for_timeout(2000)  # Wait for dice animation
            return "roll_dice"

    # 7. Any generic .option-button visible anywhere (fallback)
    any_opt = page.locator(".option-button:visible")
    if any_opt.count() > 0:
        any_opt.first.click(force=True)
        page.wait_for_timeout(800)
        return "generic_option"

    return ""


def is_game_over(page: Page) -> bool:
    """Check if game is finished."""
    try:
        settlement = page.locator(".settlement-overlay")
        if settlement.count() > 0 and settlement.first.is_visible():
            return True
    except:
        pass
    return False


def main():
    print("=" * 60)
    print("  Nannaricher Playwright E2E Game Test")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx1 = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
        page1 = ctx1.new_page()
        page2 = ctx2.new_page()
        page1.set_default_timeout(30000)
        page2.set_default_timeout(30000)

        names = ["Player1", "Player2"]

        try:
            # Create & join room
            print("\n[1] Creating room...")
            code = create_room(page1, names[0])

            print("[2] Joining room...")
            join_room(page2, code, names[1])
            page1.wait_for_timeout(1500)
            shot(page1, "both-ready")

            # Start game — goes directly to playing phase (no setup_plans)
            print("[3] Starting game...")
            start_game(page1)

            # Dismiss any tutorials on both pages
            page1.wait_for_timeout(2000)
            dismiss_all_overlays(page1)
            dismiss_all_overlays(page2)

            shot(page1, "game-start-p1")
            shot(page2, "game-start-p2")

            # Game loop — handles all actions including yearly plan selection
            print("[4] Playing game...")
            start_time = time.time()
            actions = 0
            last_shot_action = -10

            while time.time() - start_time < MAX_GAME_SECONDS:
                # Check game over on both pages
                for i, pg in enumerate([page1, page2]):
                    if is_game_over(pg):
                        print(f"\n  GAME OVER detected on {names[i]}'s screen!")
                        shot(page1, "game-over-p1")
                        shot(page2, "game-over-p2")
                        print(f"  Total actions: {actions}")
                        print(f"  Duration: {time.time() - start_time:.0f}s")

                        # Read winner info
                        try:
                            winner_name = page1.locator(".settlement-winner__name").inner_text()
                            win_cond = page1.locator(".settlement-winner__condition").inner_text()
                            print(f"  Winner: {winner_name}")
                            print(f"  Condition: {win_cond}")
                        except:
                            pass

                        return

                # Try action on BOTH players every iteration (no break)
                acted = False
                for i, pg in enumerate([page1, page2]):
                    action = handle_action(pg, names[i])
                    if action:
                        actions += 1
                        acted = True
                        if actions % 5 == 0:
                            elapsed = time.time() - start_time
                            print(f"  [Action #{actions}] {names[i]}: {action} ({elapsed:.0f}s)")
                        if actions - last_shot_action >= 15:
                            last_shot_action = actions
                            shot(pg, f"action-{actions:03d}")

                if not acted:
                    page1.wait_for_timeout(500)

            print(f"\n  TIMEOUT after {MAX_GAME_SECONDS}s, {actions} actions taken")
            shot(page1, "timeout-p1")
            shot(page2, "timeout-p2")

        except Exception as e:
            print(f"\n  ERROR: {e}")
            try:
                shot(page1, "error-p1")
                shot(page2, "error-p2")
            except:
                pass
            raise
        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("  Test Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
