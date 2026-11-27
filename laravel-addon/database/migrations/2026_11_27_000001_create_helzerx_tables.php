<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('helzerx_profiles')) {
            Schema::create('helzerx_profiles', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->primary();
                $table->string('username', 120)->index();
                $table->string('display_name', 120)->default('');
                $table->text('bio')->nullable();
                $table->string('avatar_url', 500)->default('');
                $table->string('banner_url', 500)->default('');
                $table->json('social_links')->nullable();
                $table->boolean('is_public')->default(true);
                $table->boolean('email_verified')->default(true);
                $table->string('phone_number', 40)->default('');
                $table->boolean('phone_verified')->default(false);
                $table->string('recovery_email', 160)->default('');
                $table->boolean('lockdown_mode')->default(false);
                $table->string('deactivation_status', 32)->default('active');
                $table->json('following')->nullable();
                $table->json('followers')->nullable();
                $table->json('security_policy')->nullable();
                $table->json('devices')->nullable();
                $table->json('notification_prefs')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('helzerx_security_events')) {
            Schema::create('helzerx_security_events', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('type', 120);
                $table->string('ip', 64)->default('');
                $table->string('device', 120)->default('');
                $table->string('status', 24)->default('allowed');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_wallets')) {
            Schema::create('helzerx_wallets', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->primary();
                $table->decimal('balance', 12, 2)->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('helzerx_wallet_transactions')) {
            Schema::create('helzerx_wallet_transactions', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('type', 24);
                $table->decimal('amount', 12, 2);
                $table->decimal('tax_amount', 12, 2)->default(0);
                $table->string('method', 80);
                $table->string('status', 24)->index();
                $table->string('reference', 120)->default('');
                $table->string('note', 300)->default('');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_invoices')) {
            Schema::create('helzerx_invoices', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('username', 120);
                $table->string('number', 64)->unique();
                $table->string('description', 240);
                $table->decimal('subtotal', 12, 2);
                $table->decimal('tax_rate', 6, 2)->default(0);
                $table->decimal('tax_amount', 12, 2)->default(0);
                $table->decimal('discount_amount', 12, 2)->default(0);
                $table->decimal('total', 12, 2);
                $table->string('status', 24)->index();
                $table->string('method', 80);
                $table->timestamp('issued_at')->useCurrent();
                $table->timestamp('paid_at')->nullable();
            });
        }

        if (!Schema::hasTable('helzerx_coupons')) {
            Schema::create('helzerx_coupons', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('code', 64)->unique();
                $table->decimal('discount_percent', 6, 2)->default(0);
                $table->decimal('credit_bonus', 12, 2)->default(0);
                $table->unsignedInteger('max_uses')->default(100);
                $table->unsignedInteger('used_count')->default(0);
                $table->timestamp('expires_at')->nullable();
                $table->boolean('active')->default(true);
                $table->string('description', 200)->default('');
                $table->json('redeemed_by')->nullable();
            });
        }

        if (!Schema::hasTable('helzerx_payment_methods')) {
            Schema::create('helzerx_payment_methods', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('provider', 40);
                $table->string('label', 80);
                $table->string('last4', 8);
                $table->boolean('is_default')->default(false);
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_refunds')) {
            Schema::create('helzerx_refunds', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('username', 120);
                $table->string('invoice_id', 64);
                $table->string('invoice_number', 64);
                $table->decimal('amount', 12, 2);
                $table->string('reason', 400);
                $table->string('status', 24)->default('pending');
                $table->string('admin_note', 400)->default('');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_loyalty_accounts')) {
            Schema::create('helzerx_loyalty_accounts', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->primary();
                $table->string('username', 120);
                $table->string('display_name', 120);
                $table->unsignedInteger('xp')->default(50);
                $table->unsignedInteger('weekly_xp')->default(50);
                $table->unsignedInteger('monthly_xp')->default(50);
                $table->unsignedInteger('level')->default(1);
                $table->integer('points')->default(50);
                $table->unsignedInteger('streak_days')->default(0);
                $table->unsignedInteger('longest_streak')->default(0);
                $table->timestamp('last_daily_claim_at')->nullable();
                $table->timestamp('last_weekly_claim_at')->nullable();
                $table->timestamp('last_monthly_claim_at')->nullable();
                $table->timestamp('last_event_claim_at')->nullable();
                $table->string('tier', 24)->default('Standard');
                $table->timestamp('tier_expires_at')->nullable();
                $table->string('birthday_month_day', 16)->default('');
                $table->string('referral_code', 32)->unique();
                $table->string('referred_by', 32)->nullable();
                $table->unsignedInteger('referral_count')->default(0);
                $table->decimal('referral_earnings', 12, 2)->default(0);
                $table->json('badges')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('helzerx_reward_claims')) {
            Schema::create('helzerx_reward_claims', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('type', 24);
                $table->string('title', 160);
                $table->integer('xp_delta')->default(0);
                $table->integer('points_delta')->default(0);
                $table->decimal('wallet_delta', 12, 2)->default(0);
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_tickets')) {
            Schema::create('helzerx_tickets', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('username', 120);
                $table->string('subject', 180);
                $table->string('category', 40);
                $table->string('department', 80);
                $table->string('priority', 24);
                $table->string('status', 24)->index();
                $table->string('assigned_agent_id', 64)->nullable();
                $table->string('assigned_agent_name', 120)->nullable();
                $table->unsignedTinyInteger('rating')->nullable();
                $table->string('rating_comment', 400)->default('');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('helzerx_ticket_messages')) {
            Schema::create('helzerx_ticket_messages', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('ticket_id', 64)->index();
                $table->string('author', 120);
                $table->string('role', 24);
                $table->boolean('internal_note')->default(false);
                $table->text('body');
                $table->longText('attachments_json')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_community_posts')) {
            Schema::create('helzerx_community_posts', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('author_username', 120);
                $table->string('author_display_name', 120);
                $table->string('author_avatar', 500)->default('');
                $table->string('author_tier', 24)->default('Standard');
                $table->string('category', 40);
                $table->string('title', 180);
                $table->text('body');
                $table->json('hashtags')->nullable();
                $table->json('mentions')->nullable();
                $table->boolean('pinned')->default(false);
                $table->json('likes')->nullable();
                $table->json('dislikes')->nullable();
                $table->json('reactions')->nullable();
                $table->json('bookmarks')->nullable();
                $table->json('comments')->nullable();
                $table->unsignedInteger('views')->default(1);
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_announcements')) {
            Schema::create('helzerx_announcements', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('title', 180);
                $table->string('category', 40);
                $table->string('priority', 24)->default('normal');
                $table->string('target_audience', 24)->default('all');
                $table->string('display_mode', 24)->default('feed');
                $table->boolean('pinned')->default(false);
                $table->boolean('archived')->default(false);
                $table->timestamp('publish_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->text('body');
                $table->string('author', 120);
                $table->json('read_by')->nullable();
                $table->json('reactions')->nullable();
                $table->json('comments')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_notifications')) {
            Schema::create('helzerx_notifications', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('user_id', 64)->index();
                $table->string('category', 32);
                $table->string('priority', 24)->default('normal');
                $table->string('title', 180);
                $table->string('body', 400);
                $table->boolean('is_read')->default(false);
                $table->string('link_page', 32)->default('dashboard');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('helzerx_incidents')) {
            Schema::create('helzerx_incidents', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('title', 160);
                $table->string('component', 120);
                $table->string('status', 32);
                $table->text('message');
                $table->timestamp('created_at')->useCurrent();
                $table->timestamp('resolved_at')->nullable();
            });
        }

        if (!Schema::hasTable('helzerx_store')) {
            Schema::create('helzerx_store', function (Blueprint $table) {
                $table->string('key', 80)->primary();
                $table->longText('value');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('helzerx_store');
        Schema::dropIfExists('helzerx_incidents');
        Schema::dropIfExists('helzerx_notifications');
        Schema::dropIfExists('helzerx_announcements');
        Schema::dropIfExists('helzerx_community_posts');
        Schema::dropIfExists('helzerx_ticket_messages');
        Schema::dropIfExists('helzerx_tickets');
        Schema::dropIfExists('helzerx_reward_claims');
        Schema::dropIfExists('helzerx_loyalty_accounts');
        Schema::dropIfExists('helzerx_refunds');
        Schema::dropIfExists('helzerx_payment_methods');
        Schema::dropIfExists('helzerx_coupons');
        Schema::dropIfExists('helzerx_invoices');
        Schema::dropIfExists('helzerx_wallet_transactions');
        Schema::dropIfExists('helzerx_wallets');
        Schema::dropIfExists('helzerx_security_events');
        Schema::dropIfExists('helzerx_profiles');
    }
};
