<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Pterodactyl\Http\Controllers\Controller;

class HelzerxController extends Controller
{
    private function uid(string $prefix = 'hx'): string
    {
        return $prefix . '_' . bin2hex(random_bytes(6));
    }

    private function nowIso(): string
    {
        return Carbon::now()->toIso8601String();
    }

    private function generateBackupCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 6; $i++) {
            $hex = strtoupper(bin2hex(random_bytes(4)));
            $codes[] = substr($hex, 0, 4) . '-' . substr($hex, 4, 4);
        }
        return $codes;
    }

    private function getStore(string $key, $default)
    {
        $row = DB::table('helzerx_store')->where('key', $key)->first();
        if (!$row) {
            DB::table('helzerx_store')->insert([
                'key' => $key,
                'value' => json_encode($default),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
            return $default;
        }
        $decoded = json_decode($row->value, true);
        return $decoded === null ? $default : $decoded;
    }

    private function setStore(string $key, $value): void
    {
        $exists = DB::table('helzerx_store')->where('key', $key)->exists();
        $payload = json_encode($value);
        if ($exists) {
            DB::table('helzerx_store')->where('key', $key)->update([
                'value' => $payload,
                'updated_at' => Carbon::now(),
            ]);
        } else {
            DB::table('helzerx_store')->insert([
                'key' => $key,
                'value' => $payload,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }
    }

    private function ensureDefaultsSeeded(): void
    {
        if (DB::table('helzerx_coupons')->count() === 0) {
            DB::table('helzerx_coupons')->insert([
                [
                    'id' => 'cpn_welcome10',
                    'code' => 'WELCOME10',
                    'discount_percent' => 10,
                    'credit_bonus' => 5,
                    'max_uses' => 500,
                    'used_count' => 0,
                    'expires_at' => null,
                    'active' => true,
                    'description' => 'New member $5.00 wallet credit + 10% plan discount',
                    'redeemed_by' => json_encode([]),
                ],
                [
                    'id' => 'cpn_helzer20',
                    'code' => 'HELZER20',
                    'discount_percent' => 20,
                    'credit_bonus' => 0,
                    'max_uses' => 200,
                    'used_count' => 0,
                    'expires_at' => null,
                    'active' => true,
                    'description' => '20% promotional discount on hosting upgrades',
                    'redeemed_by' => json_encode([]),
                ],
            ]);
        }

        if (DB::table('helzerx_incidents')->count() === 0) {
            DB::table('helzerx_incidents')->insert([
                'id' => 'inc_core',
                'title' => 'All Core Services Operational',
                'component' => 'Control Panel & Wings API',
                'status' => 'operational',
                'message' => 'Panel API, WebSocket console relays, billing bridge, and notification workers are healthy.',
                'created_at' => Carbon::now(),
                'resolved_at' => Carbon::now(),
            ]);
        }

        if (DB::table('helzerx_announcements')->count() === 0) {
            DB::table('helzerx_announcements')->insert([
                'id' => 'ann_platform_launch',
                'title' => 'HelzerX Platform Hub Now Live',
                'category' => 'Release',
                'priority' => 'high',
                'target_audience' => 'all',
                'display_mode' => 'banner',
                'pinned' => true,
                'archived' => false,
                'publish_at' => Carbon::now(),
                'expires_at' => null,
                'body' => 'HelzerX now includes customizable dashboards, Wallet & Invoices, Rewards & Leaderboards, Support Attachments, Community Discussions, and real-time Notifications.',
                'author' => 'HelzerX Team',
                'read_by' => json_encode([]),
                'reactions' => json_encode(['🎉' => []]),
                'comments' => json_encode([]),
                'created_at' => Carbon::now(),
            ]);
        }

        if (DB::table('helzerx_community_posts')->count() === 0) {
            DB::table('helzerx_community_posts')->insert([
                'id' => 'post_welcome',
                'user_id' => 0,
                'author_username' => 'helzerx',
                'author_display_name' => 'HelzerX Team',
                'author_avatar' => '',
                'author_tier' => 'VIP',
                'category' => 'General',
                'title' => 'Welcome to the HelzerX Community Hub',
                'body' => 'Share server setups, #optimization guides, plugin recommendations, and feature requests with fellow creators. Use #hashtags and @mentions in any discussion!',
                'hashtags' => json_encode(['helzerx', 'optimization']),
                'mentions' => json_encode([]),
                'pinned' => true,
                'likes' => json_encode([]),
                'dislikes' => json_encode([]),
                'reactions' => json_encode(['🚀' => [], '🔥' => []]),
                'bookmarks' => json_encode([]),
                'comments' => json_encode([]),
                'views' => 1,
                'created_at' => Carbon::now(),
            ]);
        }
    }

    private function defaultBillingConfig(): array
    {
        return [
            'taxRatePercent' => 0,
            'currency' => 'USD',
            'enabledGateways' => ['Stripe', 'PayPal', 'PayHere', 'Manual Bank Transfer'],
            'manualPaymentInstructions' => 'Transfer to HelzerX Hosting Ltd, reference your username, and submit the transaction ID below for admin verification.',
        ];
    }

    private function defaultPlans(): array
    {
        return [
            ['id' => 'plan_starter', 'name' => 'Starter Node', 'tagline' => 'Ideal for small PaperMC or Discord bot instances', 'category' => 'Game Servers', 'priceMonthly' => 4.99, 'cpuLimit' => 100, 'memoryMb' => 2048, 'diskMb' => 15360, 'backupsLimit' => 2, 'databasesLimit' => 1, 'egg' => 'PaperMC'],
            ['id' => 'plan_pro', 'name' => 'Ryzen Boost 4G', 'tagline' => 'Balanced NVMe compute for active multiplayer communities', 'category' => 'Game Servers', 'priceMonthly' => 9.99, 'cpuLimit' => 200, 'memoryMb' => 4096, 'diskMb' => 35840, 'backupsLimit' => 5, 'databasesLimit' => 3, 'egg' => 'PaperMC / Fabric', 'popular' => true],
            ['id' => 'plan_app', 'name' => 'Runtime Container', 'tagline' => 'Dedicated Node.js, Python, or Go automation hosting', 'category' => 'Applications', 'priceMonthly' => 6.5, 'cpuLimit' => 150, 'memoryMb' => 2048, 'diskMb' => 20480, 'backupsLimit' => 3, 'databasesLimit' => 2, 'egg' => 'Node.js / Python'],
            ['id' => 'plan_proxy', 'name' => 'Velocity Edge', 'tagline' => 'Low-latency network routing with DDoS protection', 'category' => 'Proxies', 'priceMonthly' => 7.99, 'cpuLimit' => 150, 'memoryMb' => 2048, 'diskMb' => 10240, 'backupsLimit' => 3, 'databasesLimit' => 1, 'egg' => 'Velocity'],
        ];
    }

    private function badgesCatalog(): array
    {
        return [
            ['id' => 'badge_pioneer', 'name' => 'HelzerX Pioneer', 'description' => 'Joined the HelzerX Control Panel platform', 'category' => 'Loyalty', 'xpReward' => 50, 'rarity' => 'common'],
            ['id' => 'badge_streak_7', 'name' => '7-Day Streak', 'description' => 'Claimed daily check-in rewards 7 days in a row', 'category' => 'Loyalty', 'xpReward' => 150, 'rarity' => 'rare'],
            ['id' => 'badge_guardian', 'name' => 'Security Guardian', 'description' => 'Configured recovery email and security questions', 'category' => 'Security', 'xpReward' => 100, 'rarity' => 'rare'],
            ['id' => 'badge_community', 'name' => 'Community Contributor', 'description' => 'Published discussions or guides in the Community Forum', 'category' => 'Community', 'xpReward' => 120, 'rarity' => 'epic'],
            ['id' => 'badge_patron', 'name' => 'Cloud Patron', 'description' => 'Completed a wallet top-up or plan purchase', 'category' => 'Billing', 'xpReward' => 200, 'rarity' => 'legendary'],
        ];
    }

    private function defaultShopItems(): array
    {
        return [
            ['id' => 'shop_credit_2', 'name' => '$2.00 Wallet Credit', 'description' => 'Convert 200 Loyalty Points directly into spendable wallet balance.', 'costPoints' => 200, 'type' => 'wallet_credit', 'value' => 2, 'stock' => 999],
            ['id' => 'shop_credit_5', 'name' => '$5.00 Wallet Credit', 'description' => 'Convert 450 Loyalty Points into $5.00 hosting wallet credit.', 'costPoints' => 450, 'type' => 'wallet_credit', 'value' => 5, 'stock' => 999],
            ['id' => 'shop_vip_30', 'name' => '30 Days VIP Membership', 'description' => 'Unlock priority ticket routing, VIP badge, and 1.5x daily streak XP.', 'costPoints' => 600, 'type' => 'vip_days', 'value' => 30, 'stock' => 100],
            ['id' => 'shop_xp_boost', 'name' => '+300 Bonus XP Pack', 'description' => 'Instant XP boost to advance your rank on the global leaderboard.', 'costPoints' => 150, 'type' => 'xp_boost', 'value' => 300, 'stock' => 999],
        ];
    }

    private function defaultAgents(): array
    {
        return [
            ['id' => 'agent_nethum', 'name' => 'Nethum', 'role' => 'Lead Infrastructure Engineer', 'department' => 'Node Infrastructure', 'online' => true, 'resolvedCount' => 142, 'avgRating' => 4.9],
            ['id' => 'agent_kavindu', 'name' => 'Kavindu', 'role' => 'Senior Support Specialist', 'department' => 'Technical Support', 'online' => true, 'resolvedCount' => 98, 'avgRating' => 4.8],
            ['id' => 'agent_billing', 'name' => 'HelzerX Billing Desk', 'role' => 'Accounts & Verification', 'department' => 'Billing & Renewals', 'online' => true, 'resolvedCount' => 76, 'avgRating' => 4.9],
        ];
    }

    private function defaultTemplates(): array
    {
        return [
            ['id' => 'tpl_investigating', 'title' => 'Investigating Node Diagnostics', 'department' => 'Technical Support', 'body' => 'Thanks for reaching out. Our engineering team is checking your Wings daemon logs and node allocation metrics right now and will update you shortly.'],
            ['id' => 'tpl_payment_verified', 'title' => 'Manual Payment Approved', 'department' => 'Billing & Renewals', 'body' => 'We have verified your payment reference and credited your HelzerX wallet. Your updated receipt is now available under Billing > Invoices.'],
            ['id' => 'tpl_resolved', 'title' => 'Issue Resolved Confirmation', 'department' => 'Technical Support', 'body' => 'Glad we could help get this sorted! Feel free to rate this ticket or reopen it anytime if anything else comes up.'],
        ];
    }

    private function defaultKnowledgeBase(): array
    {
        $now = $this->nowIso();
        return [
            ['id' => 'kb_sftp', 'title' => 'Connecting via SFTP & SSH Keys', 'category' => 'Getting Started', 'summary' => 'How to connect FileZilla or WinSCP using your SSH public key and server SFTP port.', 'content' => 'Open Account Settings -> SSH Keys to add your Ed25519 public key. Then open your server Settings page to copy the SFTP host and port (default 2022) and sign in with your panel username.', 'helpfulCount' => 18, 'views' => 124, 'updatedAt' => $now],
            ['id' => 'kb_2fa', 'title' => 'Securing Your Account with 2FA & Backup Codes', 'category' => 'Security', 'summary' => 'Best practices for TOTP authenticator apps, backup recovery codes, and API IP allowlists.', 'content' => 'Enable Two-Factor Authentication under Account Settings. Always store your backup recovery codes offline and restrict every Client API key to specific trusted IP addresses.', 'helpfulCount' => 25, 'views' => 192, 'updatedAt' => $now],
            ['id' => 'kb_eula', 'title' => 'Fixing Minecraft EULA & Startup Flags', 'category' => 'Troubleshooting', 'summary' => 'Why Minecraft servers stop on first boot and how to accept /eula.txt in one click.', 'content' => 'PaperMC and Vanilla servers require eula=true inside /eula.txt before starting. HelzerX automatically detects the EULA prompt in your console and lets you accept and boot immediately.', 'helpfulCount' => 31, 'views' => 260, 'updatedAt' => $now],
            ['id' => 'kb_wallet', 'title' => 'Using Wallet Credits, Coupons & Invoices', 'category' => 'Billing', 'summary' => 'How to top up your HelzerX wallet, apply promo codes, and download receipts.', 'content' => 'Visit Billing -> Overview & Wallet to top up funds or redeem a coupon code like WELCOME10. All completed transactions automatically generate tax-itemized invoices you can print or export.', 'helpfulCount' => 14, 'views' => 95, 'updatedAt' => $now],
        ];
    }

    private function ensureUser(Request $request): object
    {
        $this->ensureDefaultsSeeded();
        $user = $request->user();
        $uid = (int) $user->id;
        $displayName = trim(($user->name_first ?? '') . ' ' . ($user->name_last ?? '')) ?: $user->username;

        if (!DB::table('helzerx_profiles')->where('user_id', $uid)->exists()) {
            $ua = (string) $request->userAgent();
            $browser = str_contains($ua, 'Chrome') ? 'Chrome' : (str_contains($ua, 'Firefox') ? 'Firefox' : (str_contains($ua, 'Safari') ? 'Safari' : 'Browser'));
            $os = str_contains($ua, 'Android') ? 'Android' : (str_contains($ua, 'iPhone') ? 'iOS' : (str_contains($ua, 'Windows') ? 'Windows' : (str_contains($ua, 'Mac') ? 'macOS' : 'Linux')));

            DB::table('helzerx_profiles')->insert([
                'user_id' => $uid,
                'username' => $user->username,
                'display_name' => $displayName,
                'bio' => '',
                'avatar_url' => '',
                'banner_url' => '',
                'social_links' => json_encode(['discord' => '', 'github' => '', 'website' => '', 'twitter' => '']),
                'is_public' => true,
                'email_verified' => true,
                'phone_number' => '',
                'phone_verified' => false,
                'recovery_email' => (string) $user->email,
                'lockdown_mode' => false,
                'deactivation_status' => 'active',
                'following' => json_encode([]),
                'followers' => json_encode([]),
                'security_policy' => json_encode([
                    'loginOtpEnabled' => false,
                    'emailLoginAlerts' => true,
                    'newDeviceAlerts' => true,
                    'ipLoginAlerts' => false,
                    'suspiciousLoginProtection' => true,
                    'loginAttemptLimit' => 5,
                    'sessionTimeoutMinutes' => 120,
                    'passwordExpiryDays' => 0,
                    'captchaOnLogin' => false,
                    'antiBotEnabled' => true,
                    'securityQuestions' => [],
                    'backupCodes' => $this->generateBackupCodes(),
                ]),
                'devices' => json_encode([[
                    'id' => $this->uid('dev'),
                    'label' => 'Current Browser Session',
                    'browser' => $browser,
                    'os' => $os,
                    'ip' => (string) $request->ip(),
                    'trusted' => true,
                    'current' => true,
                    'lastSeenAt' => $this->nowIso(),
                ]]),
                'notification_prefs' => json_encode([
                    'browserEnabled' => false,
                    'emailEnabled' => true,
                    'soundEnabled' => false,
                    'discordWebhookUrl' => '',
                    'telegramBotToken' => '',
                    'telegramChatId' => '',
                    'quietHoursStart' => '',
                    'quietHoursEnd' => '',
                    'categories' => ['security' => true, 'billing' => true, 'support' => true, 'community' => true, 'announcement' => true, 'reward' => true],
                ]),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        if (!DB::table('helzerx_wallets')->where('user_id', $uid)->exists()) {
            DB::table('helzerx_wallets')->insert([
                'user_id' => $uid,
                'balance' => 0,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        if (!DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->exists()) {
            $cleanUser = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $user->username) ?: 'USER');
            $refCode = 'HX-' . substr($cleanUser, 0, 6) . '-' . $uid;
            DB::table('helzerx_loyalty_accounts')->insert([
                'user_id' => $uid,
                'username' => $user->username,
                'display_name' => $displayName,
                'xp' => 50,
                'weekly_xp' => 50,
                'monthly_xp' => 50,
                'level' => 1,
                'points' => 50,
                'streak_days' => 0,
                'longest_streak' => 0,
                'tier' => 'Standard',
                'birthday_month_day' => '',
                'referral_code' => $refCode,
                'referral_count' => 0,
                'referral_earnings' => 0,
                'badges' => json_encode(['badge_pioneer']),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        return $user;
    }

    private function formatProfileRow($row): array
    {
        return [
            'userId' => (string) $row->user_id,
            'username' => $row->username,
            'displayName' => $row->display_name,
            'bio' => (string) ($row->bio ?? ''),
            'avatarUrl' => $row->avatar_url ?? '',
            'bannerUrl' => $row->banner_url ?? '',
            'socialLinks' => json_decode($row->social_links ?? '{}', true) ?: ['discord' => '', 'github' => '', 'website' => '', 'twitter' => ''],
            'isPublic' => (bool) $row->is_public,
            'emailVerified' => (bool) $row->email_verified,
            'phoneNumber' => $row->phone_number ?? '',
            'phoneVerified' => (bool) $row->phone_verified,
            'recoveryEmail' => $row->recovery_email ?? '',
            'lockdownMode' => (bool) $row->lockdown_mode,
            'deactivationStatus' => $row->deactivation_status ?? 'active',
            'following' => json_decode($row->following ?? '[]', true) ?: [],
            'followers' => json_decode($row->followers ?? '[]', true) ?: [],
            'updatedAt' => Carbon::parse($row->updated_at ?? $row->created_at)->toIso8601String(),
        ];
    }

    private function formatLoyaltyRow($row): array
    {
        return [
            'userId' => (string) $row->user_id,
            'username' => $row->username,
            'displayName' => $row->display_name,
            'xp' => (int) $row->xp,
            'weeklyXp' => (int) $row->weekly_xp,
            'monthlyXp' => (int) $row->monthly_xp,
            'level' => (int) $row->level,
            'points' => (int) $row->points,
            'streakDays' => (int) $row->streak_days,
            'longestStreak' => (int) $row->longest_streak,
            'lastDailyClaimAt' => $row->last_daily_claim_at ? Carbon::parse($row->last_daily_claim_at)->toIso8601String() : null,
            'lastWeeklyClaimAt' => $row->last_weekly_claim_at ? Carbon::parse($row->last_weekly_claim_at)->toIso8601String() : null,
            'lastMonthlyClaimAt' => $row->last_monthly_claim_at ? Carbon::parse($row->last_monthly_claim_at)->toIso8601String() : null,
            'lastEventClaimAt' => $row->last_event_claim_at ? Carbon::parse($row->last_event_claim_at)->toIso8601String() : null,
            'tier' => $row->tier,
            'tierExpiresAt' => $row->tier_expires_at ? Carbon::parse($row->tier_expires_at)->toIso8601String() : null,
            'birthdayMonthDay' => (string) ($row->birthday_month_day ?? ''),
            'referralCode' => $row->referral_code,
            'referredBy' => $row->referred_by,
            'referralCount' => (int) $row->referral_count,
            'referralEarnings' => (float) $row->referral_earnings,
            'badges' => json_decode($row->badges ?? '[]', true) ?: ['badge_pioneer'],
        ];
    }

    private function isValidDiscordWebhook(?string $url): bool
    {
        if (!$url) return false;
        $parts = parse_url($url);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https') return false;
        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        return in_array($host, ['discord.com', 'ptb.discord.com', 'canary.discord.com', 'discordapp.com'], true)
            && str_starts_with($path, '/api/webhooks/');
    }

    private function pushNotification(string $userId, array $payload): void
    {
        if ($userId !== 'all') {
            $prof = DB::table('helzerx_profiles')->where('user_id', (int) $userId)->first();
            $prefs = $prof ? (json_decode($prof->notification_prefs ?? '{}', true) ?: []) : [];
            $cats = $prefs['categories'] ?? [];
            if (isset($cats[$payload['category']]) && $cats[$payload['category']] === false) {
                return;
            }
            $this->dispatchWebhooks($prefs, $payload['title'], $payload['body']);
        }

        DB::table('helzerx_notifications')->insert([
            'id' => $this->uid('ntf'),
            'user_id' => $userId,
            'category' => $payload['category'],
            'priority' => $payload['priority'] ?? 'normal',
            'title' => substr($payload['title'], 0, 180),
            'body' => substr($payload['body'], 0, 380),
            'is_read' => false,
            'link_page' => $payload['linkPage'] ?? 'dashboard',
            'created_at' => Carbon::now(),
        ]);
    }

    private function dispatchWebhooks(array $prefs, string $title, string $body): void
    {
        $discord = $prefs['discordWebhookUrl'] ?? '';
        if ($this->isValidDiscordWebhook($discord)) {
            try {
                Http::timeout(4)->post($discord, [
                    'username' => 'HelzerX Panel',
                    'embeds' => [['title' => $title, 'description' => $body, 'color' => 0x8b5cf6, 'timestamp' => $this->nowIso()]],
                ]);
            } catch (\Throwable $e) {
            }
        }
        $tgToken = $prefs['telegramBotToken'] ?? '';
        $tgChat = $prefs['telegramChatId'] ?? '';
        if ($tgToken && $tgChat) {
            try {
                Http::timeout(4)->post("https://api.telegram.org/bot{$tgToken}/sendMessage", [
                    'chat_id' => $tgChat,
                    'text' => "*{$title}*\n{$body}",
                    'parse_mode' => 'Markdown',
                ]);
            } catch (\Throwable $e) {
            }
        }
    }

    private function logSecurityEvent(int $userId, Request $request, string $type, string $status = 'allowed'): void
    {
        DB::table('helzerx_security_events')->insert([
            'id' => $this->uid('sec'),
            'user_id' => $userId,
            'type' => substr($type, 0, 120),
            'ip' => substr((string) $request->ip(), 0, 64),
            'device' => substr((string) $request->userAgent(), 0, 120),
            'status' => $status,
            'created_at' => Carbon::now(),
        ]);
    }

    private function awardXpAndBadge(int $userId, int $xpGain, int $pointsGain, ?string $badgeId = null): void
    {
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $userId)->first();
        if (!$loy) return;
        $mult = $loy->tier === 'VIP' ? 1.5 : ($loy->tier === 'Premium' ? 1.25 : 1.0);
        $xp = (int) $loy->xp + (int) round($xpGain * $mult);
        $weeklyXp = (int) $loy->weekly_xp + (int) round($xpGain * $mult);
        $monthlyXp = (int) $loy->monthly_xp + (int) round($xpGain * $mult);
        $points = (int) $loy->points + $pointsGain;
        $badges = json_decode($loy->badges ?? '[]', true) ?: ['badge_pioneer'];

        if ($badgeId && !in_array($badgeId, $badges, true)) {
            $badges[] = $badgeId;
            foreach ($this->badgesCatalog() as $b) {
                if ($b['id'] === $badgeId) {
                    $xp += $b['xpReward'];
                    $this->pushNotification((string) $userId, [
                        'category' => 'reward',
                        'priority' => 'normal',
                        'title' => 'Badge Unlocked: ' . $b['name'],
                        'body' => $b['description'] . ' (+' . $b['xpReward'] . ' XP)',
                        'linkPage' => 'rewards',
                    ]);
                }
            }
        }

        $level = max(1, (int) floor($xp / 250) + 1);
        DB::table('helzerx_loyalty_accounts')->where('user_id', $userId)->update([
            'xp' => $xp,
            'weekly_xp' => $weeklyXp,
            'monthly_xp' => $monthlyXp,
            'level' => $level,
            'points' => $points,
            'badges' => json_encode($badges),
            'updated_at' => Carbon::now(),
        ]);
    }

    public function bootstrap(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $profRow = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $loyRow = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        $walletRow = DB::table('helzerx_wallets')->where('user_id', $uid)->first();

        $notifications = DB::table('helzerx_notifications')
            ->where(function ($q) use ($uid) {
                $q->where('user_id', (string) $uid)->orWhere('user_id', 'all');
            })
            ->orderByDesc('created_at')
            ->limit(40)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'userId' => $n->user_id,
                'category' => $n->category,
                'priority' => $n->priority,
                'title' => $n->title,
                'body' => $n->body,
                'read' => (bool) $n->is_read,
                'linkPage' => $n->link_page,
                'createdAt' => Carbon::parse($n->created_at)->toIso8601String(),
            ])->values()->all();

        $now = Carbon::now();
        $announcements = DB::table('helzerx_announcements')
            ->where('archived', false)
            ->orderByDesc('pinned')
            ->orderByDesc('created_at')
            ->get()
            ->filter(function ($a) use ($u, $loyRow, $now) {
                if ($a->target_audience === 'admins' && !$u->root_admin) return false;
                if ($a->target_audience === 'vip' && $loyRow->tier !== 'VIP' && !$u->root_admin) return false;
                if ($a->publish_at && Carbon::parse($a->publish_at)->gt($now)) return false;
                if ($a->expires_at && Carbon::parse($a->expires_at)->lt($now)) return false;
                return true;
            })
            ->map(fn ($a) => $this->formatAnnouncement($a))
            ->values()->all();

        $incidents = DB::table('helzerx_incidents')->orderByDesc('created_at')->limit(20)->get()->map(fn ($i) => [
            'id' => $i->id,
            'title' => $i->title,
            'component' => $i->component,
            'status' => $i->status,
            'message' => $i->message,
            'createdAt' => Carbon::parse($i->created_at)->toIso8601String(),
            'resolvedAt' => $i->resolved_at ? Carbon::parse($i->resolved_at)->toIso8601String() : null,
        ])->values()->all();

        $events = DB::table('helzerx_security_events')->where('user_id', $uid)->orderByDesc('created_at')->limit(30)->get()->map(fn ($e) => [
            'id' => $e->id,
            'userId' => (string) $e->user_id,
            'type' => $e->type,
            'ip' => $e->ip,
            'device' => $e->device,
            'status' => $e->status,
            'createdAt' => Carbon::parse($e->created_at)->toIso8601String(),
        ])->values()->all();

        $txs = DB::table('helzerx_wallet_transactions')->where('user_id', $uid)->orderByDesc('created_at')->limit(5)->get()->map(fn ($t) => $this->formatTx($t))->values()->all();

        return response()->json([
            'userId' => (string) $uid,
            'username' => $u->username,
            'isAdmin' => (bool) $u->root_admin,
            'profile' => $this->formatProfileRow($profRow),
            'securityPolicy' => json_decode($profRow->security_policy ?? '{}', true),
            'devices' => json_decode($profRow->devices ?? '[]', true),
            'securityEvents' => $events,
            'walletBalance' => round((float) ($walletRow->balance ?? 0), 2),
            'loyalty' => $this->formatLoyaltyRow($loyRow),
            'unreadNotifications' => count(array_filter($notifications, fn ($n) => !$n['read'])),
            'notifications' => $notifications,
            'notificationPrefs' => json_decode($profRow->notification_prefs ?? '{}', true),
            'activeAnnouncements' => $announcements,
            'incidents' => $incidents,
            'recentTransactions' => $txs,
        ]);
    }

    private function formatTx($t): array
    {
        return [
            'id' => $t->id,
            'userId' => (string) $t->user_id,
            'type' => $t->type,
            'amount' => (float) $t->amount,
            'taxAmount' => (float) $t->tax_amount,
            'method' => $t->method,
            'status' => $t->status,
            'reference' => $t->reference,
            'note' => $t->note,
            'createdAt' => Carbon::parse($t->created_at)->toIso8601String(),
        ];
    }

    private function formatAnnouncement($a): array
    {
        return [
            'id' => $a->id,
            'title' => $a->title,
            'category' => $a->category,
            'priority' => $a->priority,
            'targetAudience' => $a->target_audience,
            'displayMode' => $a->display_mode,
            'pinned' => (bool) $a->pinned,
            'archived' => (bool) $a->archived,
            'publishAt' => Carbon::parse($a->publish_at ?? $a->created_at)->toIso8601String(),
            'expiresAt' => $a->expires_at ? Carbon::parse($a->expires_at)->toIso8601String() : null,
            'body' => $a->body,
            'author' => $a->author,
            'readBy' => json_decode($a->read_by ?? '[]', true) ?: [],
            'reactions' => json_decode($a->reactions ?? '{}', true) ?: (object) [],
            'comments' => json_decode($a->comments ?? '[]', true) ?: [],
            'createdAt' => Carbon::parse($a->created_at)->toIso8601String(),
        ];
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $cur = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $updates = ['updated_at' => Carbon::now()];
        if ($request->has('displayName')) $updates['display_name'] = substr((string) $request->input('displayName'), 0, 64);
        if ($request->has('bio')) $updates['bio'] = substr((string) $request->input('bio'), 0, 500);
        if ($request->has('avatarUrl')) $updates['avatar_url'] = substr((string) $request->input('avatarUrl'), 0, 400);
        if ($request->has('bannerUrl')) $updates['banner_url'] = substr((string) $request->input('bannerUrl'), 0, 400);
        if (is_array($request->input('socialLinks'))) $updates['social_links'] = json_encode($request->input('socialLinks'));
        if ($request->has('isPublic')) $updates['is_public'] = (bool) $request->input('isPublic');
        if ($request->has('phoneNumber')) {
            $phone = substr((string) $request->input('phoneNumber'), 0, 30);
            $updates['phone_number'] = $phone;
            if ($phone !== $cur->phone_number) $updates['phone_verified'] = false;
        }
        if ($request->has('recoveryEmail')) $updates['recovery_email'] = substr((string) $request->input('recoveryEmail'), 0, 120);

        DB::table('helzerx_profiles')->where('user_id', $uid)->update($updates);
        if (isset($updates['display_name'])) {
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['display_name' => $updates['display_name']]);
        }
        return response()->json(['profile' => $this->formatProfileRow(DB::table('helzerx_profiles')->where('user_id', $uid)->first())]);
    }

    public function verifyContact(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $channel = $request->input('channel', 'email');
        if ($channel === 'phone') {
            if (!trim((string) $prof->phone_number)) return response()->json(['error' => 'Add a phone number first.'], 400);
            DB::table('helzerx_profiles')->where('user_id', $uid)->update(['phone_verified' => true, 'updated_at' => Carbon::now()]);
        } else {
            DB::table('helzerx_profiles')->where('user_id', $uid)->update(['email_verified' => true, 'updated_at' => Carbon::now()]);
        }
        $this->logSecurityEvent($uid, $request, 'contact.verified:' . ($channel === 'phone' ? 'phone' : 'email'));
        return response()->json(['profile' => $this->formatProfileRow(DB::table('helzerx_profiles')->where('user_id', $uid)->first())]);
    }

    public function updateDeactivation(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $action = $request->input('action');
        if (!in_array($action, ['active', 'deactivated', 'deletion_requested'], true)) {
            return response()->json(['error' => 'Invalid deactivation status.'], 400);
        }
        DB::table('helzerx_profiles')->where('user_id', (int) $u->id)->update(['deactivation_status' => $action, 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent((int) $u->id, $request, 'account.status:' . $action, $action === 'active' ? 'allowed' : 'flagged');
        return response()->json(['profile' => $this->formatProfileRow(DB::table('helzerx_profiles')->where('user_id', (int) $u->id)->first())]);
    }

    public function publicProfile(Request $request, string $username): JsonResponse
    {
        $viewer = $this->ensureUser($request);
        $target = DB::table('helzerx_profiles')->whereRaw('LOWER(username) = ?', [strtolower(urldecode($username))])->first();
        if (!$target) return response()->json(['error' => 'User profile not found.'], 404);
        if (!$target->is_public && (int) $target->user_id !== (int) $viewer->id && !$viewer->root_admin) {
            return response()->json(['error' => 'This user has set their profile to Private Mode.'], 403);
        }
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $target->user_id)->first();
        $posts = DB::table('helzerx_community_posts')->where('user_id', $target->user_id)->orderByDesc('created_at')->limit(8)->get()->map(fn ($p) => [
            'id' => $p->id, 'title' => $p->title, 'category' => $p->category, 'createdAt' => Carbon::parse($p->created_at)->toIso8601String(),
        ])->all();
        return response()->json([
            'profile' => $this->formatProfileRow($target),
            'loyalty' => $loy ? $this->formatLoyaltyRow($loy) : ['level' => 1, 'xp' => 0, 'tier' => 'Standard', 'badges' => ['badge_pioneer'], 'streakDays' => 0],
            'recentPosts' => $posts,
        ]);
    }

    public function updateSecuritySettings(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $policy = json_decode($prof->security_policy ?? '{}', true) ?: [];
        foreach (['loginOtpEnabled', 'emailLoginAlerts', 'newDeviceAlerts', 'ipLoginAlerts', 'suspiciousLoginProtection', 'captchaOnLogin', 'antiBotEnabled'] as $boolKey) {
            if ($request->has($boolKey)) $policy[$boolKey] = (bool) $request->input($boolKey);
        }
        if ($request->has('loginAttemptLimit')) $policy['loginAttemptLimit'] = max(3, min(20, (int) $request->input('loginAttemptLimit')));
        if ($request->has('sessionTimeoutMinutes')) $policy['sessionTimeoutMinutes'] = max(15, min(1440, (int) $request->input('sessionTimeoutMinutes')));
        if ($request->has('passwordExpiryDays')) $policy['passwordExpiryDays'] = max(0, min(365, (int) $request->input('passwordExpiryDays')));
        if (is_array($request->input('securityQuestions'))) {
            $qs = [];
            foreach (array_slice($request->input('securityQuestions'), 0, 3) as $q) {
                if (!empty($q['question']) && !empty($q['answerHint'])) {
                    $qs[] = ['id' => $q['id'] ?? $this->uid('sq'), 'question' => substr((string) $q['question'], 0, 140), 'answerHint' => substr((string) $q['answerHint'], 0, 60)];
                }
            }
            $policy['securityQuestions'] = $qs;
            if (count($qs) > 0) $this->awardXpAndBadge($uid, 30, 20, 'badge_guardian');
        }
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['security_policy' => json_encode($policy), 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'security.policy.updated');
        return response()->json(['securityPolicy' => $policy]);
    }

    public function regenerateBackupCodes(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $policy = json_decode($prof->security_policy ?? '{}', true) ?: [];
        $codes = $this->generateBackupCodes();
        $policy['backupCodes'] = $codes;
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['security_policy' => json_encode($policy), 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'security.backup_codes.regenerated');
        return response()->json(['backupCodes' => $codes]);
    }

    public function toggleDeviceTrust(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $devices = json_decode($prof->devices ?? '[]', true) ?: [];
        foreach ($devices as &$d) {
            if (($d['id'] ?? '') === $id) $d['trusted'] = !($d['trusted'] ?? false);
        }
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['devices' => json_encode($devices), 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'device.trust.toggled');
        return response()->json(['devices' => $devices]);
    }

    public function revokeDevice(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $devices = array_values(array_filter(json_decode($prof->devices ?? '[]', true) ?: [], fn ($d) => ($d['id'] ?? '') !== $id));
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['devices' => json_encode($devices), 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'device.revoked');
        return response()->json(['devices' => $devices]);
    }

    public function forceLogoutAll(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $devices = array_values(array_filter(json_decode($prof->devices ?? '[]', true) ?: [], fn ($d) => (bool) ($d['current'] ?? false)));
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['devices' => json_encode($devices), 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'sessions.force_logout_all', 'flagged');
        $this->pushNotification((string) $uid, ['category' => 'security', 'priority' => 'high', 'title' => 'All Other Devices Logged Out', 'body' => 'External active sessions were revoked.', 'linkPage' => 'account']);
        return response()->json(['devices' => $devices]);
    }

    public function toggleLockdown(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $enabled = (bool) $request->input('enabled', false);
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['lockdown_mode' => $enabled, 'updated_at' => Carbon::now()]);
        $this->logSecurityEvent($uid, $request, 'security.lockdown.' . ($enabled ? 'enabled' : 'disabled'), $enabled ? 'flagged' : 'allowed');
        $this->pushNotification((string) $uid, ['category' => 'security', 'priority' => 'high', 'title' => $enabled ? 'Account Lockdown Activated' : 'Account Lockdown Lifted', 'body' => $enabled ? 'Sensitive billing actions are locked.' : 'Normal account access restored.', 'linkPage' => 'account']);
        return response()->json(['lockdownMode' => $enabled]);
    }

    public function getBilling(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $wallet = DB::table('helzerx_wallets')->where('user_id', $uid)->first();
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        $config = $this->getStore('billing_config', $this->defaultBillingConfig());
        $plans = $this->getStore('plans', $this->defaultPlans());

        $txs = DB::table('helzerx_wallet_transactions')->where('user_id', $uid)->orderByDesc('created_at')->get()->map(fn ($t) => $this->formatTx($t))->values()->all();
        $invsQuery = DB::table('helzerx_invoices');
        if (!$u->root_admin) $invsQuery->where('user_id', $uid);
        $invoices = $invsQuery->orderByDesc('issued_at')->get()->map(fn ($i) => [
            'id' => $i->id, 'userId' => (string) $i->user_id, 'username' => $i->username, 'number' => $i->number,
            'description' => $i->description, 'subtotal' => (float) $i->subtotal, 'taxRate' => (float) $i->tax_rate,
            'taxAmount' => (float) $i->tax_amount, 'discountAmount' => (float) $i->discount_amount, 'total' => (float) $i->total,
            'status' => $i->status, 'method' => $i->method, 'issuedAt' => Carbon::parse($i->issued_at)->toIso8601String(),
            'paidAt' => $i->paid_at ? Carbon::parse($i->paid_at)->toIso8601String() : null,
        ])->values()->all();

        $couponsQuery = DB::table('helzerx_coupons');
        if (!$u->root_admin) $couponsQuery->where('active', true);
        $coupons = $couponsQuery->get()->map(fn ($c) => [
            'id' => $c->id, 'code' => $c->code, 'discountPercent' => (float) $c->discount_percent,
            'creditBonus' => (float) $c->credit_bonus, 'maxUses' => (int) $c->max_uses, 'usedCount' => (int) $c->used_count,
            'expiresAt' => $c->expires_at, 'active' => (bool) $c->active, 'description' => $c->description,
        ])->values()->all();

        $methods = DB::table('helzerx_payment_methods')->where('user_id', $uid)->orderByDesc('created_at')->get()->map(fn ($m) => [
            'id' => $m->id, 'userId' => (string) $m->user_id, 'provider' => $m->provider, 'label' => $m->label,
            'last4' => $m->last4, 'isDefault' => (bool) $m->is_default, 'createdAt' => Carbon::parse($m->created_at)->toIso8601String(),
        ])->values()->all();

        $refundsQuery = DB::table('helzerx_refunds');
        if (!$u->root_admin) $refundsQuery->where('user_id', $uid);
        $refunds = $refundsQuery->orderByDesc('created_at')->get()->map(fn ($r) => [
            'id' => $r->id, 'userId' => (string) $r->user_id, 'username' => $r->username, 'invoiceId' => $r->invoice_id,
            'invoiceNumber' => $r->invoice_number, 'amount' => (float) $r->amount, 'reason' => $r->reason,
            'status' => $r->status, 'adminNote' => $r->admin_note, 'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
        ])->values()->all();

        $pendingQuery = DB::table('helzerx_wallet_transactions')->where('status', 'pending');
        if (!$u->root_admin) $pendingQuery->where('user_id', $uid);
        $pending = $pendingQuery->orderByDesc('created_at')->get()->map(fn ($t) => $this->formatTx($t))->values()->all();

        return response()->json([
            'walletBalance' => round((float) ($wallet->balance ?? 0), 2),
            'loyaltyPoints' => (int) $loy->points,
            'referralCode' => $loy->referral_code,
            'referralCount' => (int) $loy->referral_count,
            'referralEarnings' => (float) $loy->referral_earnings,
            'config' => $config,
            'plans' => $plans,
            'transactions' => $txs,
            'invoices' => $invoices,
            'coupons' => $coupons,
            'paymentMethods' => $methods,
            'refunds' => $refunds,
            'pendingManualPayments' => $pending,
        ]);
    }

    public function addFunds(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        if ($prof->lockdown_mode) return response()->json(['error' => 'Account is in Lockdown Mode.'], 423);

        $amount = (float) $request->input('amount', 0);
        $method = (string) $request->input('method', 'Stripe');
        $reference = trim((string) $request->input('reference', '')) ?: 'TX-' . substr((string) time(), -6);
        if ($amount < 1 || $amount > 5000) return response()->json(['error' => 'Amount must be between $1.00 and $5,000.00.'], 400);

        $isManual = str_contains(strtolower($method), 'manual') || str_contains(strtolower($method), 'bank');
        $cfg = $this->getStore('billing_config', $this->defaultBillingConfig());
        $taxRate = (float) ($cfg['taxRatePercent'] ?? 0);
        $taxAmount = round(($amount * $taxRate) / 100, 2);
        $totalCharged = round($amount + $taxAmount, 2);

        $txId = $this->uid('tx');
        $invId = $this->uid('inv');
        $invNum = 'INV-' . date('Y') . '-' . (DB::table('helzerx_invoices')->count() + 1001);

        DB::transaction(function () use ($uid, $u, $amount, $taxRate, $taxAmount, $totalCharged, $method, $reference, $isManual, $txId, $invId, $invNum) {
            DB::table('helzerx_wallet_transactions')->insert([
                'id' => $txId, 'user_id' => $uid, 'type' => 'credit', 'amount' => $amount, 'tax_amount' => $taxAmount,
                'method' => $method, 'status' => $isManual ? 'pending' : 'completed', 'reference' => $reference,
                'note' => $isManual ? 'Manual payment verification pending' : "Wallet top-up via {$method}", 'created_at' => Carbon::now(),
            ]);
            DB::table('helzerx_invoices')->insert([
                'id' => $invId, 'user_id' => $uid, 'username' => $u->username, 'number' => $invNum,
                'description' => sprintf('Wallet Credit Top-Up ($%.2f)', $amount),
                'subtotal' => $amount, 'tax_rate' => $taxRate, 'tax_amount' => $taxAmount, 'discount_amount' => 0, 'total' => $totalCharged,
                'status' => $isManual ? 'pending' : 'paid', 'method' => $method, 'issued_at' => Carbon::now(), 'paid_at' => $isManual ? null : Carbon::now(),
            ]);
            if (!$isManual) {
                DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', $amount);
                $this->awardXpAndBadge($uid, (int) round($amount * 5), (int) round($amount * 2), 'badge_patron');
            }
        });

        $wallet = DB::table('helzerx_wallets')->where('user_id', $uid)->first();
        $tx = $this->formatTx(DB::table('helzerx_wallet_transactions')->where('id', $txId)->first());
        return response()->json(['transaction' => $tx, 'walletBalance' => round((float) $wallet->balance, 2)]);
    }

    public function verifyPayment(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $txId = (string) $request->input('transactionId');
        $approve = (bool) $request->input('approve', false);
        $tx = DB::table('helzerx_wallet_transactions')->where('id', $txId)->where('status', 'pending')->first();
        if (!$tx) return response()->json(['error' => 'Pending transaction not found.'], 404);

        DB::transaction(function () use ($tx, $u, $approve) {
            DB::table('helzerx_wallet_transactions')->where('id', $tx->id)->update([
                'status' => $approve ? 'completed' : 'rejected',
                'note' => ($approve ? 'Verified & approved by ' : 'Rejected by ') . $u->username,
            ]);
            $inv = DB::table('helzerx_invoices')->where('user_id', $tx->user_id)->where('status', 'pending')->orderByDesc('issued_at')->first();
            if ($approve) {
                DB::table('helzerx_wallets')->where('user_id', $tx->user_id)->increment('balance', (float) $tx->amount);
                if ($inv) DB::table('helzerx_invoices')->where('id', $inv->id)->update(['status' => 'paid', 'paid_at' => Carbon::now()]);
                $this->awardXpAndBadge((int) $tx->user_id, (int) round($tx->amount * 5), (int) round($tx->amount * 2), 'badge_patron');
                $this->pushNotification((string) $tx->user_id, ['category' => 'billing', 'priority' => 'high', 'title' => sprintf('Payment Approved (+$%.2f)', $tx->amount), 'body' => "Reference {$tx->reference} credited.", 'linkPage' => 'billing']);
            } else {
                if ($inv) DB::table('helzerx_invoices')->where('id', $inv->id)->update(['status' => 'overdue']);
                $this->pushNotification((string) $tx->user_id, ['category' => 'billing', 'priority' => 'high', 'title' => 'Manual Payment Rejected', 'body' => "Reference {$tx->reference} declined.", 'linkPage' => 'billing']);
            }
        });

        return response()->json(['transaction' => $this->formatTx(DB::table('helzerx_wallet_transactions')->where('id', $txId)->first())]);
    }

    public function purchasePlan(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        if ($prof->lockdown_mode) return response()->json(['error' => 'Account is in Lockdown Mode.'], 423);

        $plans = $this->getStore('plans', $this->defaultPlans());
        $plan = null;
        foreach ($plans as $p) {
            if ($p['id'] === $id) $plan = $p;
        }
        if (!$plan) return response()->json(['error' => 'Plan not found.'], 404);

        $couponCode = strtoupper(trim((string) $request->input('couponCode', '')));
        $discount = 0.0;
        if ($couponCode !== '') {
            $cpn = DB::table('helzerx_coupons')->whereRaw('UPPER(code) = ?', [$couponCode])->where('active', true)->first();
            if (!$cpn) return response()->json(['error' => 'Invalid or inactive coupon code.'], 400);
            if ($cpn->used_count >= $cpn->max_uses) return response()->json(['error' => 'Coupon usage limit reached.'], 400);
            $discount = round(((float) $plan['priceMonthly'] * (float) $cpn->discount_percent) / 100, 2);
            DB::table('helzerx_coupons')->where('id', $cpn->id)->increment('used_count');
        }

        $subtotal = max(0, round((float) $plan['priceMonthly'] - $discount, 2));
        $cfg = $this->getStore('billing_config', $this->defaultBillingConfig());
        $taxRate = (float) ($cfg['taxRatePercent'] ?? 0);
        $taxAmount = round(($subtotal * $taxRate) / 100, 2);
        $total = round($subtotal + $taxAmount, 2);

        $wallet = DB::table('helzerx_wallets')->where('user_id', $uid)->first();
        $bal = (float) ($wallet->balance ?? 0);
        if ($bal < $total) return response()->json(['error' => sprintf('Insufficient wallet balance ($%.2f). Required: $%.2f.', $bal, $total)], 400);

        $invId = $this->uid('inv');
        $invNum = 'INV-' . date('Y') . '-' . (DB::table('helzerx_invoices')->count() + 1001);
        DB::transaction(function () use ($uid, $u, $plan, $couponCode, $discount, $taxRate, $taxAmount, $total, $invId, $invNum) {
            DB::table('helzerx_wallets')->where('user_id', $uid)->decrement('balance', $total);
            DB::table('helzerx_wallet_transactions')->insert([
                'id' => $this->uid('tx'), 'user_id' => $uid, 'type' => 'debit', 'amount' => $total, 'tax_amount' => $taxAmount,
                'method' => 'HelzerX Wallet', 'status' => 'completed', 'reference' => 'PLAN-' . strtoupper($plan['id']),
                'note' => 'Purchased ' . $plan['name'] . ($couponCode ? " (Coupon: {$couponCode})" : ''), 'created_at' => Carbon::now(),
            ]);
            DB::table('helzerx_invoices')->insert([
                'id' => $invId, 'user_id' => $uid, 'username' => $u->username, 'number' => $invNum,
                'description' => $plan['name'] . ' — Monthly Hosting Plan',
                'subtotal' => (float) $plan['priceMonthly'], 'tax_rate' => $taxRate, 'tax_amount' => $taxAmount,
                'discount_amount' => $discount, 'total' => $total, 'status' => 'paid', 'method' => 'HelzerX Wallet',
                'issued_at' => Carbon::now(), 'paid_at' => Carbon::now(),
            ]);
            $this->awardXpAndBadge($uid, 75, 40, 'badge_patron');
            $this->pushNotification((string) $uid, ['category' => 'billing', 'priority' => 'normal', 'title' => 'Order Confirmed: ' . $plan['name'], 'body' => "Invoice {$invNum} paid.", 'linkPage' => 'billing']);
        });

        $newBal = (float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance');
        return response()->json(['walletBalance' => round($newBal, 2)]);
    }

    public function redeemCoupon(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $code = strtoupper(trim((string) $request->input('code', '')));
        $cpn = DB::table('helzerx_coupons')->whereRaw('UPPER(code) = ?', [$code])->where('active', true)->first();
        if (!$cpn) return response()->json(['error' => 'Promo code not found or expired.'], 404);
        if ($cpn->used_count >= $cpn->max_uses) return response()->json(['error' => 'Promo code redemption limit reached.'], 400);

        $redeemed = json_decode($cpn->redeemed_by ?? '[]', true) ?: [];
        if (in_array($uid, $redeemed, true)) return response()->json(['error' => 'You already redeemed this promo code.'], 400);

        if ((float) $cpn->credit_bonus <= 0) {
            return response()->json(['message' => "{$cpn->discount_percent}% discount code \"{$cpn->code}\" is valid! Apply at checkout.", 'walletBalance' => round((float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance'), 2)]);
        }

        $redeemed[] = $uid;
        DB::transaction(function () use ($uid, $cpn, $redeemed) {
            DB::table('helzerx_coupons')->where('id', $cpn->id)->update(['used_count' => $cpn->used_count + 1, 'redeemed_by' => json_encode($redeemed)]);
            DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', (float) $cpn->credit_bonus);
            DB::table('helzerx_wallet_transactions')->insert([
                'id' => $this->uid('tx'), 'user_id' => $uid, 'type' => 'reward', 'amount' => (float) $cpn->credit_bonus, 'tax_amount' => 0,
                'method' => "Promo ({$cpn->code})", 'status' => 'completed', 'reference' => $cpn->code, 'note' => $cpn->description, 'created_at' => Carbon::now(),
            ]);
        });
        $bal = (float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance');
        return response()->json(['message' => sprintf('Credited +$%.2f to your wallet!', $cpn->credit_bonus), 'walletBalance' => round($bal, 2)]);
    }

    public function createCoupon(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $code = strtoupper(trim((string) $request->input('code', '')));
        if (!$code) return response()->json(['error' => 'Coupon code is required.'], 400);
        $id = $this->uid('cpn');
        DB::table('helzerx_coupons')->insert([
            'id' => $id, 'code' => $code, 'discount_percent' => max(0, min(90, (float) $request->input('discountPercent', 0))),
            'credit_bonus' => max(0, min(500, (float) $request->input('creditBonus', 0))), 'max_uses' => max(1, (int) $request->input('maxUses', 100)),
            'used_count' => 0, 'expires_at' => $request->input('expiresAt'), 'active' => true,
            'description' => substr((string) $request->input('description', 'Promotional coupon'), 0, 140), 'redeemed_by' => json_encode([]),
        ]);
        return response()->json(['ok' => true, 'id' => $id]);
    }

    public function deleteCoupon(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        DB::table('helzerx_coupons')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }

    public function addPaymentMethod(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $isDef = DB::table('helzerx_payment_methods')->where('user_id', $uid)->count() === 0;
        $last4 = substr(preg_replace('/\D/', '', (string) $request->input('last4', '4242')) ?: '0000', -4);
        DB::table('helzerx_payment_methods')->insert([
            'id' => $this->uid('pm'), 'user_id' => $uid, 'provider' => $request->input('provider', 'Stripe'),
            'label' => substr((string) $request->input('label', 'Saved Card'), 0, 60), 'last4' => $last4,
            'is_default' => $isDef, 'created_at' => Carbon::now(),
        ]);
        return response()->json(['ok' => true]);
    }

    public function deletePaymentMethod(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        DB::table('helzerx_payment_methods')->where('id', $id)->where('user_id', (int) $u->id)->delete();
        return response()->json(['ok' => true]);
    }

    public function createRefund(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $inv = DB::table('helzerx_invoices')->where('id', $request->input('invoiceId'))->where('user_id', $uid)->first();
        if (!$inv || $inv->status !== 'paid') return response()->json(['error' => 'Only paid invoices can be refunded.'], 400);
        DB::table('helzerx_refunds')->insert([
            'id' => $this->uid('ref'), 'user_id' => $uid, 'username' => $u->username, 'invoice_id' => $inv->id,
            'invoice_number' => $inv->number, 'amount' => $inv->total, 'reason' => substr((string) $request->input('reason', 'Requested refund'), 0, 300),
            'status' => 'pending', 'admin_note' => '', 'created_at' => Carbon::now(),
        ]);
        return response()->json(['ok' => true]);
    }

    public function resolveRefund(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $ref = DB::table('helzerx_refunds')->where('id', $id)->where('status', 'pending')->first();
        if (!$ref) return response()->json(['error' => 'Pending refund not found.'], 404);
        $approve = (bool) $request->input('approve', false);
        DB::transaction(function () use ($ref, $request, $approve) {
            DB::table('helzerx_refunds')->where('id', $ref->id)->update([
                'status' => $approve ? 'approved' : 'rejected',
                'admin_note' => substr((string) $request->input('adminNote', ''), 0, 300),
            ]);
            if ($approve) {
                DB::table('helzerx_invoices')->where('id', $ref->invoice_id)->update(['status' => 'refunded']);
                DB::table('helzerx_wallets')->where('user_id', $ref->user_id)->increment('balance', (float) $ref->amount);
                DB::table('helzerx_wallet_transactions')->insert([
                    'id' => $this->uid('tx'), 'user_id' => $ref->user_id, 'type' => 'refund', 'amount' => (float) $ref->amount, 'tax_amount' => 0,
                    'method' => 'Wallet Refund', 'status' => 'completed', 'reference' => $ref->invoice_number, 'note' => "Refund approved for {$ref->invoice_number}", 'created_at' => Carbon::now(),
                ]);
            }
            $this->pushNotification((string) $ref->user_id, ['category' => 'billing', 'priority' => 'high', 'title' => 'Refund ' . ($approve ? 'Approved' : 'Declined') . ': ' . $ref->invoice_number, 'body' => $approve ? sprintf('+$%.2f returned to wallet.', $ref->amount) : 'Request declined.', 'linkPage' => 'billing']);
        });
        return response()->json(['ok' => true]);
    }

    public function updateBillingConfig(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $cfg = $this->getStore('billing_config', $this->defaultBillingConfig());
        if ($request->has('taxRatePercent')) $cfg['taxRatePercent'] = max(0, min(50, (float) $request->input('taxRatePercent')));
        if ($request->has('manualPaymentInstructions')) $cfg['manualPaymentInstructions'] = substr((string) $request->input('manualPaymentInstructions'), 0, 400);
        if (is_array($request->input('enabledGateways'))) $cfg['enabledGateways'] = $request->input('enabledGateways');
        $this->setStore('billing_config', $cfg);
        return response()->json(['config' => $cfg]);
    }

    public function getRewards(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        $claims = DB::table('helzerx_reward_claims')->where('user_id', $uid)->orderByDesc('created_at')->limit(30)->get()->map(fn ($c) => [
            'id' => $c->id, 'userId' => (string) $c->user_id, 'type' => $c->type, 'title' => $c->title,
            'xpDelta' => (int) $c->xp_delta, 'pointsDelta' => (int) $c->points_delta, 'walletDelta' => (float) $c->wallet_delta,
            'createdAt' => Carbon::parse($c->created_at)->toIso8601String(),
        ])->values()->all();

        $allLoy = DB::table('helzerx_loyalty_accounts')->get()->map(fn ($l) => [
            'userId' => (string) $l->user_id, 'username' => $l->username, 'displayName' => $l->display_name,
            'level' => (int) $l->level, 'xp' => (int) $l->xp, 'weeklyXp' => (int) $l->weekly_xp,
            'monthlyXp' => (int) $l->monthly_xp, 'points' => (int) $l->points, 'streakDays' => (int) $l->streak_days,
            'tier' => $l->tier, 'referralCount' => (int) $l->referral_count,
        ])->values()->all();

        $sortBy = function (array $rows, string $field) {
            usort($rows, fn ($a, $b) => $b[$field] <=> $a[$field]);
            return array_slice($rows, 0, 20);
        };

        return response()->json([
            'account' => $this->formatLoyaltyRow($loy),
            'badgesCatalog' => $this->badgesCatalog(),
            'shopItems' => $this->getStore('shop_items', $this->defaultShopItems()),
            'claims' => $claims,
            'leaderboards' => [
                'global' => $sortBy($allLoy, 'xp'),
                'weekly' => $sortBy($allLoy, 'weeklyXp'),
                'monthly' => $sortBy($allLoy, 'monthlyXp'),
                'referrals' => $sortBy($allLoy, 'referralCount'),
            ],
        ]);
    }

    public function claimReward(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        $kind = (string) $request->input('type', 'daily');
        $now = Carbon::now();
        $xp = 0; $pts = 0; $wallet = 0.0; $title = '';

        if ($kind === 'daily') {
            if ($loy->last_daily_claim_at && Carbon::parse($loy->last_daily_claim_at)->diffInHours($now) < 20) {
                return response()->json(['error' => 'Daily reward already claimed. Come back tomorrow!'], 400);
            }
            $withinWindow = !$loy->last_daily_claim_at || Carbon::parse($loy->last_daily_claim_at)->diffInHours($now) < 48;
            $streak = $withinWindow ? ((int) $loy->streak_days + 1) : 1;
            $longest = max((int) $loy->longest_streak, $streak);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['streak_days' => $streak, 'longest_streak' => $longest, 'last_daily_claim_at' => $now]);
            $xp = 35 + min(70, $streak * 5); $pts = 20 + min(50, $streak * 3);
            $title = "Daily Check-in (Streak Day {$streak})";
            $this->awardXpAndBadge($uid, $xp, $pts, $streak >= 7 ? 'badge_streak_7' : null);
        } elseif ($kind === 'weekly') {
            if ($loy->last_weekly_claim_at && Carbon::parse($loy->last_weekly_claim_at)->diffInDays($now) < 7) {
                return response()->json(['error' => 'Weekly reward already claimed this week.'], 400);
            }
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['last_weekly_claim_at' => $now]);
            $xp = 120; $pts = 80; $title = 'Weekly Loyalty Bonus';
            $this->awardXpAndBadge($uid, $xp, $pts);
        } elseif ($kind === 'monthly') {
            if ($loy->last_monthly_claim_at && Carbon::parse($loy->last_monthly_claim_at)->diffInDays($now) < 28) {
                return response()->json(['error' => 'Monthly reward already claimed this month.'], 400);
            }
            $wallet = $loy->tier === 'VIP' ? 2.0 : ($loy->tier === 'Premium' ? 1.0 : 0.0);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['last_monthly_claim_at' => $now]);
            if ($wallet > 0) DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', $wallet);
            $xp = 300; $pts = 200; $title = "Monthly Reward ({$loy->tier})";
            $this->awardXpAndBadge($uid, $xp, $pts);
        } elseif ($kind === 'birthday') {
            $mmdd = substr(trim((string) $request->input('birthdayMonthDay', $loy->birthday_month_day)), 0, 10);
            if (!$mmdd) return response()->json(['error' => 'Set your birthday (MM-DD) first.'], 400);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['birthday_month_day' => $mmdd]);
            if ($mmdd !== $now->format('m-d')) {
                return response()->json(['message' => 'Birthday saved! Return on your birthday to claim your gift.', 'account' => $this->formatLoyaltyRow(DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first())]);
            }
            $xp = 250; $pts = 150; $wallet = 1.0; $title = 'Birthday Gift Pack';
            DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', $wallet);
            $this->awardXpAndBadge($uid, $xp, $pts);
        } else {
            if ($loy->last_event_claim_at && Carbon::parse($loy->last_event_claim_at)->diffInHours($now) < 24) {
                return response()->json(['error' => 'Special event reward already claimed today.'], 400);
            }
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['last_event_claim_at' => $now]);
            $xp = 80; $pts = 45; $title = 'HelzerX Community Event Bonus';
            $this->awardXpAndBadge($uid, $xp, $pts);
        }

        DB::table('helzerx_reward_claims')->insert([
            'id' => $this->uid('clm'), 'user_id' => $uid, 'type' => $kind, 'title' => $title,
            'xp_delta' => $xp, 'points_delta' => $pts, 'wallet_delta' => $wallet, 'created_at' => $now,
        ]);
        return response()->json([
            'account' => $this->formatLoyaltyRow(DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first()),
            'walletBalance' => round((float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance'), 2),
        ]);
    }

    public function redeemShopItem(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        $items = $this->getStore('shop_items', $this->defaultShopItems());
        $foundIdx = null;
        foreach ($items as $idx => $it) {
            if ($it['id'] === $id) $foundIdx = $idx;
        }
        if ($foundIdx === null || $items[$foundIdx]['stock'] <= 0) return response()->json(['error' => 'Reward item unavailable.'], 404);
        $item = $items[$foundIdx];
        if ((int) $loy->points < (int) $item['costPoints']) return response()->json(['error' => "Need {$item['costPoints']} points."], 400);

        $items[$foundIdx]['stock'] = max(0, $item['stock'] - 1);
        $this->setStore('shop_items', $items);
        $walletDelta = 0.0; $xpDelta = 0;
        DB::transaction(function () use ($uid, $item, &$walletDelta, &$xpDelta) {
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->decrement('points', (int) $item['costPoints']);
            if ($item['type'] === 'wallet_credit') {
                $walletDelta = (float) $item['value'];
                DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', $walletDelta);
                DB::table('helzerx_wallet_transactions')->insert([
                    'id' => $this->uid('tx'), 'user_id' => $uid, 'type' => 'reward', 'amount' => $walletDelta, 'tax_amount' => 0,
                    'method' => 'Loyalty Points Shop', 'status' => 'completed', 'reference' => $item['id'], 'note' => 'Redeemed ' . $item['name'], 'created_at' => Carbon::now(),
                ]);
            } elseif ($item['type'] === 'vip_days') {
                DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['tier' => 'VIP', 'tier_expires_at' => Carbon::now()->addDays((int) $item['value'])]);
            } elseif ($item['type'] === 'xp_boost') {
                $xpDelta = (int) $item['value'];
                $this->awardXpAndBadge($uid, $xpDelta, 0);
            }
            DB::table('helzerx_reward_claims')->insert([
                'id' => $this->uid('clm'), 'user_id' => $uid, 'type' => 'shop', 'title' => 'Redeemed: ' . $item['name'],
                'xp_delta' => $xpDelta, 'points_delta' => -(int) $item['costPoints'], 'wallet_delta' => $walletDelta, 'created_at' => Carbon::now(),
            ]);
        });

        return response()->json([
            'account' => $this->formatLoyaltyRow(DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first()),
            'walletBalance' => round((float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance'), 2),
        ]);
    }

    public function upgradeTier(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $tier = (string) $request->input('tier', '');
        $price = $tier === 'VIP' ? 9.99 : ($tier === 'Premium' ? 4.99 : 0);
        if (!$price) return response()->json(['error' => 'Select Premium or VIP tier.'], 400);
        $bal = (float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance');
        if ($bal < $price) return response()->json(['error' => sprintf('Insufficient wallet balance ($%.2f).', $bal)], 400);

        DB::transaction(function () use ($uid, $tier, $price) {
            DB::table('helzerx_wallets')->where('user_id', $uid)->decrement('balance', $price);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['tier' => $tier, 'tier_expires_at' => Carbon::now()->addDays(30)]);
            DB::table('helzerx_wallet_transactions')->insert([
                'id' => $this->uid('tx'), 'user_id' => $uid, 'type' => 'debit', 'amount' => $price, 'tax_amount' => 0,
                'method' => 'HelzerX Wallet', 'status' => 'completed', 'reference' => 'TIER-' . strtoupper($tier), 'note' => "30-day {$tier} Membership", 'created_at' => Carbon::now(),
            ]);
        });
        return response()->json([
            'account' => $this->formatLoyaltyRow(DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first()),
            'walletBalance' => round((float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance'), 2),
        ]);
    }

    public function applyReferral(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();
        if ($loy->referred_by) return response()->json(['error' => 'Referral code already applied to your account.'], 400);
        $code = strtoupper(trim((string) $request->input('code', '')));
        $ref = DB::table('helzerx_loyalty_accounts')->whereRaw('UPPER(referral_code) = ?', [$code])->where('user_id', '!=', $uid)->first();
        if (!$ref) return response()->json(['error' => 'Referral code not found.'], 404);

        DB::transaction(function () use ($uid, $ref) {
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->update(['referred_by' => $ref->referral_code]);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->increment('points', 50);
            DB::table('helzerx_loyalty_accounts')->where('user_id', $ref->user_id)->increment('referral_count');
            DB::table('helzerx_loyalty_accounts')->where('user_id', $ref->user_id)->increment('referral_earnings', 2.5);
            DB::table('helzerx_wallets')->where('user_id', $ref->user_id)->increment('balance', 2.5);
            DB::table('helzerx_wallets')->where('user_id', $uid)->increment('balance', 1.5);
        });
        return response()->json(['bonus' => 1.5, 'walletBalance' => round((float) DB::table('helzerx_wallets')->where('user_id', $uid)->value('balance'), 2)]);
    }

    public function getSupport(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $tQuery = DB::table('helzerx_tickets');
        if (!$u->root_admin) $tQuery->where('user_id', $uid);
        $tickets = $tQuery->orderByDesc('updated_at')->get()->map(function ($t) use ($u) {
            $msgs = DB::table('helzerx_ticket_messages')->where('ticket_id', $t->id)->orderBy('created_at')->get()
                ->filter(fn ($m) => $u->root_admin || !$m->internal_note)
                ->map(fn ($m) => [
                    'id' => $m->id, 'author' => $m->author, 'role' => $m->role, 'internalNote' => (bool) $m->internal_note,
                    'body' => $m->body, 'attachments' => json_decode($m->attachments_json ?? '[]', true) ?: [],
                    'createdAt' => Carbon::parse($m->created_at)->toIso8601String(),
                ])->values()->all();
            return [
                'id' => $t->id, 'userId' => (string) $t->user_id, 'username' => $t->username, 'subject' => $t->subject,
                'category' => $t->category, 'department' => $t->department, 'priority' => $t->priority, 'status' => $t->status,
                'assignedAgentId' => $t->assigned_agent_id, 'assignedAgentName' => $t->assigned_agent_name,
                'rating' => $t->rating ? (int) $t->rating : null, 'ratingComment' => $t->rating_comment,
                'createdAt' => Carbon::parse($t->created_at)->toIso8601String(),
                'updatedAt' => Carbon::parse($t->updated_at)->toIso8601String(),
                'messages' => $msgs,
            ];
        })->values()->all();

        $rated = array_filter($tickets, fn ($t) => $t['rating'] !== null);
        $avg = count($rated) ? round(array_sum(array_column($rated, 'rating')) / count($rated), 1) : 4.9;
        return response()->json([
            'tickets' => $tickets,
            'agents' => $this->defaultAgents(),
            'templates' => $this->getStore('support_templates', $this->defaultTemplates()),
            'knowledgeBase' => $this->getStore('knowledge_base', $this->defaultKnowledgeBase()),
            'stats' => [
                'total' => count($tickets),
                'open' => count(array_filter($tickets, fn ($t) => in_array($t['status'], ['open', 'answered'], true))),
                'escalated' => count(array_filter($tickets, fn ($t) => $t['status'] === 'escalated')),
                'closed' => count(array_filter($tickets, fn ($t) => $t['status'] === 'closed')),
                'avgRating' => $avg,
            ],
        ]);
    }

    public function createTicket(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $subject = trim((string) $request->input('subject', ''));
        $msg = trim((string) $request->input('message', ''));
        if (!$subject || !$msg) return response()->json(['error' => 'Subject and description are required.'], 400);

        $dept = (string) $request->input('department', 'Technical Support');
        $agents = $this->defaultAgents();
        $agent = $agents[0];
        foreach ($agents as $a) { if ($a['department'] === $dept) $agent = $a; }

        $id = 'TKT-' . (DB::table('helzerx_tickets')->count() + 101);
        $displayName = trim(($u->name_first ?? '') . ' ' . ($u->name_last ?? '')) ?: $u->username;
        DB::transaction(function () use ($id, $u, $displayName, $subject, $dept, $msg, $request, $agent) {
            DB::table('helzerx_tickets')->insert([
                'id' => $id, 'user_id' => (int) $u->id, 'username' => $u->username, 'subject' => substr($subject, 0, 140),
                'category' => (string) $request->input('category', 'Technical'), 'department' => $dept,
                'priority' => (string) $request->input('priority', 'medium'), 'status' => 'open',
                'assigned_agent_id' => $agent['id'], 'assigned_agent_name' => $agent['name'],
                'created_at' => Carbon::now(), 'updated_at' => Carbon::now(),
            ]);
            DB::table('helzerx_ticket_messages')->insert([
                'id' => $this->uid('msg'), 'ticket_id' => $id, 'author' => $displayName, 'role' => 'customer',
                'internal_note' => false, 'body' => substr($msg, 0, 4000),
                'attachments_json' => json_encode(array_slice((array) $request->input('attachments', []), 0, 3)),
                'created_at' => Carbon::now(),
            ]);
            $this->pushNotification((string) $u->id, ['category' => 'support', 'priority' => 'normal', 'title' => "Ticket Opened: {$id}", 'body' => substr($subject, 0, 100), 'linkPage' => 'support']);
        });
        return response()->json(['id' => $id]);
    }

    public function replyTicket(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $t = DB::table('helzerx_tickets')->where('id', $id)->first();
        if (!$t) return response()->json(['error' => 'Ticket not found.'], 404);
        if ((int) $t->user_id !== (int) $u->id && !$u->root_admin) return response()->json(['error' => 'Forbidden'], 403);
        $body = trim((string) $request->input('message', ''));
        if (!$body) return response()->json(['error' => 'Reply cannot be empty.'], 400);

        $isInternal = (bool) $request->input('internalNote', false) && $u->root_admin;
        $isStaffReply = $u->root_admin && (int) $t->user_id !== (int) $u->id;
        $displayName = trim(($u->name_first ?? '') . ' ' . ($u->name_last ?? '')) ?: $u->username;

        DB::table('helzerx_ticket_messages')->insert([
            'id' => $this->uid('msg'), 'ticket_id' => $id, 'author' => $displayName,
            'role' => $isStaffReply ? 'staff' : 'customer', 'internal_note' => $isInternal,
            'body' => substr($body, 0, 4000),
            'attachments_json' => json_encode(array_slice((array) $request->input('attachments', []), 0, 3)),
            'created_at' => Carbon::now(),
        ]);
        $updates = ['updated_at' => Carbon::now()];
        if (!$isInternal) {
            $updates['status'] = $isStaffReply ? 'answered' : 'open';
            if ($isStaffReply) {
                $this->pushNotification((string) $t->user_id, ['category' => 'support', 'priority' => 'high', 'title' => "New Reply on {$t->id}", 'body' => "{$u->username}: " . substr($body, 0, 90), 'linkPage' => 'support']);
            }
        }
        DB::table('helzerx_tickets')->where('id', $id)->update($updates);
        return response()->json(['ok' => true]);
    }

    public function updateTicketStatus(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $t = DB::table('helzerx_tickets')->where('id', $id)->first();
        if (!$t) return response()->json(['error' => 'Ticket not found.'], 404);
        if ((int) $t->user_id !== (int) $u->id && !$u->root_admin) return response()->json(['error' => 'Forbidden'], 403);
        $status = (string) $request->input('status', '');
        if (!in_array($status, ['open', 'answered', 'escalated', 'closed'], true)) return response()->json(['error' => 'Invalid status'], 400);
        DB::table('helzerx_tickets')->where('id', $id)->update(['status' => $status, 'updated_at' => Carbon::now()]);
        return response()->json(['ok' => true]);
    }

    public function assignTicket(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $agentId = $request->input('agentId');
        $agent = null;
        foreach ($this->defaultAgents() as $a) { if ($a['id'] === $agentId) $agent = $a; }
        if (!$agent) return response()->json(['error' => 'Agent not found.'], 404);
        DB::table('helzerx_tickets')->where('id', $id)->update(['assigned_agent_id' => $agent['id'], 'assigned_agent_name' => $agent['name'], 'updated_at' => Carbon::now()]);
        return response()->json(['ok' => true]);
    }

    public function rateTicket(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        DB::table('helzerx_tickets')->where('id', $id)->where('user_id', (int) $u->id)->update([
            'rating' => max(1, min(5, (int) $request->input('rating', 5))),
            'rating_comment' => substr((string) $request->input('comment', ''), 0, 300),
            'updated_at' => Carbon::now(),
        ]);
        return response()->json(['ok' => true]);
    }

    public function createTemplate(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $list = $this->getStore('support_templates', $this->defaultTemplates());
        array_unshift($list, ['id' => $this->uid('tpl'), 'title' => substr((string) $request->input('title', 'Template'), 0, 80), 'department' => (string) $request->input('department', 'Technical Support'), 'body' => substr((string) $request->input('body', ''), 0, 2000)]);
        $this->setStore('support_templates', $list);
        return response()->json(['ok' => true]);
    }

    public function createKbArticle(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $kb = $this->getStore('knowledge_base', $this->defaultKnowledgeBase());
        array_unshift($kb, ['id' => $this->uid('kb'), 'title' => substr((string) $request->input('title', 'Guide'), 0, 140), 'category' => (string) $request->input('category', 'Getting Started'), 'summary' => substr((string) $request->input('summary', ''), 0, 240), 'content' => substr((string) $request->input('content', ''), 0, 6000), 'helpfulCount' => 0, 'views' => 0, 'updatedAt' => $this->nowIso()]);
        $this->setStore('knowledge_base', $kb);
        return response()->json(['ok' => true]);
    }

    public function markKbHelpful(string $id): JsonResponse
    {
        $kb = $this->getStore('knowledge_base', $this->defaultKnowledgeBase());
        foreach ($kb as &$art) {
            if ($art['id'] === $id) { $art['helpfulCount'] = ($art['helpfulCount'] ?? 0) + 1; $art['views'] = ($art['views'] ?? 0) + 1; }
        }
        $this->setStore('knowledge_base', $kb);
        return response()->json(['ok' => true]);
    }

    public function getCommunity(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $posts = DB::table('helzerx_community_posts')->orderByDesc('pinned')->orderByDesc('created_at')->get()->map(fn ($p) => [
            'id' => $p->id, 'userId' => (string) $p->user_id, 'authorUsername' => $p->author_username,
            'authorDisplayName' => $p->author_display_name, 'authorAvatar' => $p->author_avatar, 'authorTier' => $p->author_tier,
            'category' => $p->category, 'title' => $p->title, 'body' => $p->body,
            'hashtags' => json_decode($p->hashtags ?? '[]', true) ?: [], 'mentions' => json_decode($p->mentions ?? '[]', true) ?: [],
            'pinned' => (bool) $p->pinned, 'likes' => json_decode($p->likes ?? '[]', true) ?: [],
            'dislikes' => json_decode($p->dislikes ?? '[]', true) ?: [], 'reactions' => json_decode($p->reactions ?? '{}', true) ?: (object) [],
            'bookmarks' => json_decode($p->bookmarks ?? '[]', true) ?: [], 'views' => (int) $p->views,
            'createdAt' => Carbon::parse($p->created_at)->toIso8601String(), 'comments' => json_decode($p->comments ?? '[]', true) ?: [],
        ])->values()->all();

        $reports = $u->root_admin ? $this->getStore('community_reports', []) : [];
        return response()->json(['posts' => $posts, 'reports' => $reports, 'following' => json_decode($prof->following ?? '[]', true) ?: []]);
    }

    public function createPost(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $title = trim((string) $request->input('title', ''));
        $body = trim((string) $request->input('body', ''));
        if (!$title || !$body) return response()->json(['error' => 'Title and content are required.'], 400);

        preg_match_all('/#([a-zA-Z0-9_-]+)/', $body, $hm);
        preg_match_all('/@([a-zA-Z0-9_.-]+)/', $body, $mm);
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $loy = DB::table('helzerx_loyalty_accounts')->where('user_id', $uid)->first();

        $id = $this->uid('post');
        DB::table('helzerx_community_posts')->insert([
            'id' => $id, 'user_id' => $uid, 'author_username' => $u->username, 'author_display_name' => $prof->display_name ?: $u->username,
            'author_avatar' => $prof->avatar_url ?? '', 'author_tier' => $loy->tier ?? 'Standard',
            'category' => (string) $request->input('category', 'General'), 'title' => substr($title, 0, 140), 'body' => substr($body, 0, 4000),
            'hashtags' => json_encode(array_values(array_unique(array_map('strtolower', $hm[1] ?? [])))),
            'mentions' => json_encode(array_values(array_unique(array_map('strtolower', $mm[1] ?? [])))),
            'pinned' => (bool) $request->input('pinned', false) && $u->root_admin,
            'likes' => json_encode([]), 'dislikes' => json_encode([]), 'reactions' => json_encode((object) []),
            'bookmarks' => json_encode([]), 'comments' => json_encode([]), 'views' => 1, 'created_at' => Carbon::now(),
        ]);
        $this->awardXpAndBadge($uid, 30, 15, 'badge_community');
        return response()->json(['id' => $id]);
    }

    public function reactPost(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (string) $u->id;
        $p = DB::table('helzerx_community_posts')->where('id', $id)->first();
        if (!$p) return response()->json(['error' => 'Post not found.'], 404);
        $likes = json_decode($p->likes ?? '[]', true) ?: [];
        $dislikes = json_decode($p->dislikes ?? '[]', true) ?: [];
        $reactions = json_decode($p->reactions ?? '{}', true) ?: [];
        $type = $request->input('type'); $emoji = $request->input('emoji');

        if ($type === 'like') {
            $dislikes = array_values(array_diff($dislikes, [$uid]));
            $likes = in_array($uid, $likes, true) ? array_values(array_diff($likes, [$uid])) : [...$likes, $uid];
        } elseif ($type === 'dislike') {
            $likes = array_values(array_diff($likes, [$uid]));
            $dislikes = in_array($uid, $dislikes, true) ? array_values(array_diff($dislikes, [$uid])) : [...$dislikes, $uid];
        } elseif ($emoji) {
            $list = $reactions[$emoji] ?? [];
            $reactions[$emoji] = in_array($uid, $list, true) ? array_values(array_diff($list, [$uid])) : [...$list, $uid];
        }
        DB::table('helzerx_community_posts')->where('id', $id)->update(['likes' => json_encode($likes), 'dislikes' => json_encode($dislikes), 'reactions' => json_encode($reactions)]);
        return response()->json(['ok' => true]);
    }

    public function bookmarkPost(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (string) $u->id;
        $p = DB::table('helzerx_community_posts')->where('id', $id)->first();
        if (!$p) return response()->json(['error' => 'Post not found.'], 404);
        $bm = json_decode($p->bookmarks ?? '[]', true) ?: [];
        $bm = in_array($uid, $bm, true) ? array_values(array_diff($bm, [$uid])) : [...$bm, $uid];
        DB::table('helzerx_community_posts')->where('id', $id)->update(['bookmarks' => json_encode($bm)]);
        return response()->json(['ok' => true]);
    }

    public function commentPost(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $p = DB::table('helzerx_community_posts')->where('id', $id)->first();
        if (!$p) return response()->json(['error' => 'Post not found.'], 404);
        $body = trim((string) $request->input('body', ''));
        if (!$body) return response()->json(['error' => 'Comment cannot be empty.'], 400);
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $comments = json_decode($p->comments ?? '[]', true) ?: [];
        $comments[] = ['id' => $this->uid('cmt'), 'userId' => (string) $uid, 'authorUsername' => $u->username, 'authorDisplayName' => $prof->display_name ?: $u->username, 'body' => substr($body, 0, 1200), 'createdAt' => $this->nowIso()];
        DB::table('helzerx_community_posts')->where('id', $id)->update(['comments' => json_encode($comments)]);
        $this->awardXpAndBadge($uid, 10, 5);
        if ((int) $p->user_id !== $uid && (int) $p->user_id > 0) {
            $this->pushNotification((string) $p->user_id, ['category' => 'community', 'priority' => 'normal', 'title' => "{$u->username} commented on your post", 'body' => $p->title, 'linkPage' => 'community']);
        }
        return response()->json(['ok' => true]);
    }

    public function reportPost(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $p = DB::table('helzerx_community_posts')->where('id', $id)->first();
        if (!$p) return response()->json(['error' => 'Post not found.'], 404);
        $reports = $this->getStore('community_reports', []);
        array_unshift($reports, ['id' => $this->uid('rep'), 'postId' => $id, 'postTitle' => $p->title, 'reporterUsername' => $u->username, 'reason' => substr((string) $request->input('reason', 'Inappropriate content'), 0, 240), 'status' => 'open', 'createdAt' => $this->nowIso()]);
        $this->setStore('community_reports', $reports);
        return response()->json(['ok' => true]);
    }

    public function toggleFollow(Request $request, string $username): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $following = json_decode($prof->following ?? '[]', true) ?: [];
        $following = in_array($username, $following, true) ? array_values(array_diff($following, [$username])) : [...$following, $username];
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['following' => json_encode($following)]);
        return response()->json(['following' => $following]);
    }

    public function deletePost(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $p = DB::table('helzerx_community_posts')->where('id', $id)->first();
        if (!$p) return response()->json(['error' => 'Post not found.'], 404);
        if ((int) $p->user_id !== (int) $u->id && !$u->root_admin) return response()->json(['error' => 'Forbidden'], 403);
        DB::table('helzerx_community_posts')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }

    public function resolveReport(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $reports = $this->getStore('community_reports', []);
        $action = (string) $request->input('action', 'resolve');
        foreach ($reports as &$r) {
            if ($r['id'] === $id) {
                $r['status'] = $action === 'dismiss' ? 'dismissed' : 'resolved';
                if ($action === 'remove_post') DB::table('helzerx_community_posts')->where('id', $r['postId'])->delete();
            }
        }
        $this->setStore('community_reports', $reports);
        return response()->json(['ok' => true]);
    }

    public function getUpdates(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $anns = DB::table('helzerx_announcements')->orderByDesc('pinned')->orderByDesc('created_at')->get()->map(fn ($a) => $this->formatAnnouncement($a))->values()->all();
        $incs = DB::table('helzerx_incidents')->orderByDesc('created_at')->get()->map(fn ($i) => [
            'id' => $i->id, 'title' => $i->title, 'component' => $i->component, 'status' => $i->status, 'message' => $i->message,
            'createdAt' => Carbon::parse($i->created_at)->toIso8601String(), 'resolvedAt' => $i->resolved_at ? Carbon::parse($i->resolved_at)->toIso8601String() : null,
        ])->values()->all();
        $notifs = DB::table('helzerx_notifications')->where(fn ($q) => $q->where('user_id', (string) $uid)->orWhere('user_id', 'all'))->orderByDesc('created_at')->limit(60)->get()->map(fn ($n) => [
            'id' => $n->id, 'userId' => $n->user_id, 'category' => $n->category, 'priority' => $n->priority, 'title' => $n->title,
            'body' => $n->body, 'read' => (bool) $n->is_read, 'linkPage' => $n->link_page, 'createdAt' => Carbon::parse($n->created_at)->toIso8601String(),
        ])->values()->all();

        return response()->json(['announcements' => $anns, 'incidents' => $incs, 'notifications' => $notifs, 'notificationPrefs' => json_decode($prof->notification_prefs ?? '{}', true)]);
    }

    public function createAnnouncement(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $title = trim((string) $request->input('title', '')); $body = trim((string) $request->input('body', ''));
        if (!$title || !$body) return response()->json(['error' => 'Title and message are required.'], 400);
        $id = $this->uid('ann');
        $displayName = trim(($u->name_first ?? '') . ' ' . ($u->name_last ?? '')) ?: $u->username;
        DB::table('helzerx_announcements')->insert([
            'id' => $id, 'title' => substr($title, 0, 140), 'category' => (string) $request->input('category', 'General'),
            'priority' => (string) $request->input('priority', 'normal'), 'target_audience' => (string) $request->input('targetAudience', 'all'),
            'display_mode' => (string) $request->input('displayMode', 'feed'), 'pinned' => (bool) $request->input('pinned', false),
            'archived' => false, 'publish_at' => $request->input('publishAt') ? Carbon::parse($request->input('publishAt')) : Carbon::now(),
            'expires_at' => $request->input('expiresAt') ? Carbon::parse($request->input('expiresAt')) : null,
            'body' => substr($body, 0, 4000), 'author' => $displayName, 'read_by' => json_encode([]),
            'reactions' => json_encode((object) []), 'comments' => json_encode([]), 'created_at' => Carbon::now(),
        ]);
        $this->pushNotification('all', ['category' => 'announcement', 'priority' => $request->input('priority') === 'critical' ? 'high' : 'normal', 'title' => "Announcement: {$title}", 'body' => substr($body, 0, 110), 'linkPage' => 'updates']);
        return response()->json(['id' => $id]);
    }

    public function updateAnnouncement(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $updates = [];
        if ($request->has('pinned')) $updates['pinned'] = (bool) $request->input('pinned');
        if ($request->has('archived')) $updates['archived'] = (bool) $request->input('archived');
        if ($updates) DB::table('helzerx_announcements')->where('id', $id)->update($updates);
        return response()->json(['ok' => true]);
    }

    public function deleteAnnouncement(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        DB::table('helzerx_announcements')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }

    public function markAnnouncementRead(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $a = DB::table('helzerx_announcements')->where('id', $id)->first();
        if (!$a) return response()->json(['error' => 'Not found'], 404);
        $readBy = json_decode($a->read_by ?? '[]', true) ?: [];
        if (!in_array((string) $u->id, $readBy, true)) $readBy[] = (string) $u->id;
        DB::table('helzerx_announcements')->where('id', $id)->update(['read_by' => json_encode($readBy)]);
        return response()->json(['ok' => true]);
    }

    public function reactAnnouncement(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $a = DB::table('helzerx_announcements')->where('id', $id)->first();
        if (!$a) return response()->json(['error' => 'Not found'], 404);
        $emoji = (string) $request->input('emoji', '👍');
        $reactions = json_decode($a->reactions ?? '{}', true) ?: [];
        $list = $reactions[$emoji] ?? [];
        $uid = (string) $u->id;
        $reactions[$emoji] = in_array($uid, $list, true) ? array_values(array_diff($list, [$uid])) : [...$list, $uid];
        DB::table('helzerx_announcements')->where('id', $id)->update(['reactions' => json_encode($reactions)]);
        return response()->json(['ok' => true]);
    }

    public function commentAnnouncement(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        $a = DB::table('helzerx_announcements')->where('id', $id)->first();
        if (!$a) return response()->json(['error' => 'Not found'], 404);
        $body = trim((string) $request->input('body', ''));
        if (!$body) return response()->json(['error' => 'Comment required.'], 400);
        $comments = json_decode($a->comments ?? '[]', true) ?: [];
        $comments[] = ['id' => $this->uid('ac'), 'author' => $u->username, 'body' => substr($body, 0, 600), 'createdAt' => $this->nowIso()];
        DB::table('helzerx_announcements')->where('id', $id)->update(['comments' => json_encode($comments)]);
        return response()->json(['ok' => true]);
    }

    public function createIncident(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $status = (string) $request->input('status', 'maintenance');
        $id = $this->uid('inc');
        DB::table('helzerx_incidents')->insert([
            'id' => $id, 'title' => substr((string) $request->input('title', 'Service Update'), 0, 120),
            'component' => substr((string) $request->input('component', 'Panel API'), 0, 80), 'status' => $status,
            'message' => substr((string) $request->input('message', ''), 0, 800), 'created_at' => Carbon::now(),
            'resolved_at' => $status === 'operational' ? Carbon::now() : null,
        ]);
        return response()->json(['id' => $id]);
    }

    public function updateIncident(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        if (!$u->root_admin) return response()->json(['error' => 'Admin permission required.'], 403);
        $status = (string) $request->input('status', 'operational');
        DB::table('helzerx_incidents')->where('id', $id)->update(['status' => $status, 'resolved_at' => $status === 'operational' ? Carbon::now() : null]);
        return response()->json(['ok' => true]);
    }

    public function readAllNotifications(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        DB::table('helzerx_notifications')->where('user_id', (string) $u->id)->update(['is_read' => true]);
        return response()->json(['ok' => true]);
    }

    public function readNotification(Request $request, string $id): JsonResponse
    {
        $u = $this->ensureUser($request);
        DB::table('helzerx_notifications')->where('id', $id)->where('user_id', (string) $u->id)->update(['is_read' => true]);
        return response()->json(['ok' => true]);
    }

    public function updateNotificationPrefs(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $uid = (int) $u->id;
        $prof = DB::table('helzerx_profiles')->where('user_id', $uid)->first();
        $cur = json_decode($prof->notification_prefs ?? '{}', true) ?: [];
        foreach (['browserEnabled', 'emailEnabled', 'soundEnabled'] as $bk) {
            if ($request->has($bk)) $cur[$bk] = (bool) $request->input($bk);
        }
        foreach (['discordWebhookUrl', 'telegramBotToken', 'telegramChatId', 'quietHoursStart', 'quietHoursEnd'] as $sk) {
            if ($request->has($sk)) $cur[$sk] = trim((string) $request->input($sk));
        }
        if (is_array($request->input('categories'))) {
            $cur['categories'] = array_merge($cur['categories'] ?? [], $request->input('categories'));
        }
        DB::table('helzerx_profiles')->where('user_id', $uid)->update(['notification_prefs' => json_encode($cur), 'updated_at' => Carbon::now()]);
        return response()->json(['notificationPrefs' => $cur]);
    }

    public function testWebhook(Request $request): JsonResponse
    {
        $u = $this->ensureUser($request);
        $prof = DB::table('helzerx_profiles')->where('user_id', (int) $u->id)->first();
        $prefs = json_decode($prof->notification_prefs ?? '{}', true) ?: [];
        $hasDiscord = $this->isValidDiscordWebhook($prefs['discordWebhookUrl'] ?? '');
        $hasTg = !empty($prefs['telegramBotToken']) && !empty($prefs['telegramChatId']);
        if (!$hasDiscord && !$hasTg) {
            return response()->json(['error' => 'Configure a valid Discord Webhook URL or Telegram Bot Token + Chat ID first.'], 400);
        }
        $this->dispatchWebhooks($prefs, 'HelzerX Notification Test', "Test alert triggered by {$u->username} at " . Carbon::now()->toDateTimeString());
        return response()->json(['ok' => true]);
    }
}
