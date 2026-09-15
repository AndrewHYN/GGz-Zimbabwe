# GGz Media Audit Report

**Date:** 2025-09-15  
**Baseline Commit:** bb9b9c6  
**Auditor:** Automated audit script

---

## Executive Summary

The GGz application has significant missing media across multiple content types. The primary issue is **empty database fields** rather than broken storage or URL construction. The IGDB integration exists but credentials are not configured.

---

## Audit Results by Content Type

### 1. GamerProfile (4 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| avatar | 4 | 0 | 4 | ✅ Working |
| cover | 4 | 4 | 0 | ❌ Missing content |

**Root cause:** Empty database field (Type 1/2)  
**Repair:** Requires user upload or default cover generation

### 2. Game (4 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| cover_art_url | 4 | 4 | 0 | ❌ Empty field |
| trailer_url | 4 | 0 | 4 | ✅ Working |

**Root cause:** Empty database field (Type 1)  
**Repair:** Requires IGDB sync (credentials not configured)

### 3. Tournament (3 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| banner | 3 | 2 | 1 | ⚠️ Partial |

**Root cause:** Missing content (Type 2)  
**Repair:** Requires user/organizer upload

### 4. Event (2 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| banner | 2 | 2 | 0 | ❌ Missing |

**Root cause:** Missing content (Type 2)  
**Repair:** Requires organizer upload

### 5. Organization (2 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| logo | 2 | 2 | 0 | ❌ Missing |

**Root cause:** Missing content (Type 2)  
**Repair:** Requires organization admin upload

### 5. Listing (2 records)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| images | 2 | 0 | 2 | ✅ Working |

### 7. Team (1 record)
| Field | Total | Empty | Working | Status |
|-------|-------|-------|---------|--------|
| logo | 1 | 1 | 0 | ❌ Missing |
| banner | 1 | 1 | 0 | ❌ Missing |

---

## Root Cause Classification

| Category | Count | Description |
|----------|-------|-------------|
| **Type 1: Empty database field** | 15 | Fields exist but are empty strings/NULL |
| **Type 2: Missing content** | 11 | No legitimate source for the content |
| **Type 12: Missing population workflow** | 4 | Game covers need IGDB sync |

---

## IGDB Integration Status

**Service exists:** ✅ `games/services/igdb.py` (481 lines)  
**Sync command:** ✅ `games/management/commands/sync_igdb.py`  
**Model fields:** ✅ `Game` model has `igdb_id`, `cover_art_url`, `igdb_last_synced`, etc.

**Credentials:** ❌ NOT CONFIGURED
- `IGDB_CLIENT_ID`: empty
- `IGDB_CLIENT_SECRET`: empty

**Blocker:** Cannot run IGDB sync without Twitch developer credentials.

---

## Storage Configuration

**Development:** Local filesystem (`hello_world/media/`)  
**Production:** Supabase S3-compatible (requires AWS_* env vars)  
**Media serving:** Custom `_serve_media` view in `urls.py`  
**Static files:** `staticfiles` directory with `collectstatic`

**Status:** Working for uploaded files (avatars, listing images, tournament banner)

---

## Template Issues Found

### Fixed in M12.3 (bb9b9c6):
- ✅ Game cover fallbacks with `.media-fallback` system
- ✅ Tournament banner fallbacks
- ✅ Event banner fallbacks
- ✅ Template `onerror` handlers

### Remaining Issues:
1. **Event cards in `event_list.html`** - No banner display at all
2. **Organization cards** - No logo display
3. **Team cards** - No logo/banner display
4. **Profile cover** - Empty fallback only
4. **Team detail page** - No logo/banner display

---

## Recommended Actions

### Immediate (Code Fixes - No Credentials Needed):
1. ✅ Add fallback system for all image types (DONE in M12.3)
2. Fix Event list cards to show banners
3. Fix Organization list/profile to show logos
3. Fix Team list/detail to show logos/banners
4. Improve Profile cover fallback

### Requires IGDB Credentials:
1. Set up Twitch developer app → Get IGDB_CLIENT_ID/SECRET
2. Run `python manage.py sync_igdb --all` to populate game covers
3. Schedule periodic sync via cron/job

### Content Population (Owner Action Required):
1. User profile covers → User upload
2. Event banners → Organizer upload
3. Organization logos → Admin upload
4. Team logos/banners → Team captain upload
5. Tournament banners → Organizer upload

---

## Summary Table

| Content Type | Records | Working | Fix Type | Priority |
|--------------|---------|---------|----------|----------|
| Game covers | 4 | 0 | IGDB sync | HIGH |
| Profile covers | 4 | 0 | User upload | MEDIUM |
| Tournament banners | 3 | 1 | User upload | MEDIUM |
| Event banners | 2 | 0 | Organizer upload | MEDIUM |
| Org logos | 2 | 0 | Admin upload | MEDIUM |
| Team logos/banners | 1 | 0 | Captain upload | LOW |
| Avatars | 4 | 4 | ✅ Done | - |
| Listing images | 2 | 2 | ✅ Done | - |

---

## Recommendation

**Phase 1 (Immediate):** Fix template rendering for Event/Org/Team media with proper fallbacks
**Phase 2 (IGDB):** Configure Twitch credentials and run game sync
**Phase 3 (Content):** Create admin workflows for non-game media uploads

The code infrastructure is solid - the main gaps are missing content and missing IGDB credentials.