<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Api\Client\HelzerxController;

Route::prefix('helzerx')->group(function () {
    Route::get('/bootstrap', [HelzerxController::class, 'bootstrap']);

    // Extended profile & security policy
    Route::put('/profile', [HelzerxController::class, 'updateProfile']);
    Route::post('/profile/verify-contact', [HelzerxController::class, 'verifyContact']);
    Route::post('/profile/deactivation', [HelzerxController::class, 'updateDeactivation']);
    Route::get('/profile/{username}', [HelzerxController::class, 'publicProfile']);

    Route::put('/security/settings', [HelzerxController::class, 'updateSecuritySettings']);
    Route::post('/security/backup-codes/regenerate', [HelzerxController::class, 'regenerateBackupCodes']);
    Route::post('/security/devices/{id}/trust', [HelzerxController::class, 'toggleDeviceTrust']);
    Route::delete('/security/devices/{id}', [HelzerxController::class, 'revokeDevice']);
    Route::post('/security/sessions/force-logout', [HelzerxController::class, 'forceLogoutAll']);
    Route::put('/security/lockdown', [HelzerxController::class, 'toggleLockdown']);

    // Billing, wallet, coupons, invoices, refunds
    Route::get('/billing', [HelzerxController::class, 'getBilling']);
    Route::post('/billing/add-funds', [HelzerxController::class, 'addFunds']);
    Route::post('/billing/verify-payment', [HelzerxController::class, 'verifyPayment']);
    Route::post('/billing/plans/{id}/purchase', [HelzerxController::class, 'purchasePlan']);
    Route::post('/billing/coupons/redeem', [HelzerxController::class, 'redeemCoupon']);
    Route::post('/billing/coupons', [HelzerxController::class, 'createCoupon']);
    Route::delete('/billing/coupons/{id}', [HelzerxController::class, 'deleteCoupon']);
    Route::post('/billing/methods', [HelzerxController::class, 'addPaymentMethod']);
    Route::delete('/billing/methods/{id}', [HelzerxController::class, 'deletePaymentMethod']);
    Route::post('/billing/refunds', [HelzerxController::class, 'createRefund']);
    Route::post('/billing/refunds/{id}/resolve', [HelzerxController::class, 'resolveRefund']);
    Route::put('/billing/config', [HelzerxController::class, 'updateBillingConfig']);

    // Rewards, shop, memberships, leaderboards
    Route::get('/rewards', [HelzerxController::class, 'getRewards']);
    Route::post('/rewards/claim', [HelzerxController::class, 'claimReward']);
    Route::post('/rewards/shop/{id}/redeem', [HelzerxController::class, 'redeemShopItem']);
    Route::post('/rewards/tier/upgrade', [HelzerxController::class, 'upgradeTier']);
    Route::post('/rewards/referral/apply', [HelzerxController::class, 'applyReferral']);

    // Support & knowledge base
    Route::get('/support', [HelzerxController::class, 'getSupport']);
    Route::post('/support/tickets', [HelzerxController::class, 'createTicket']);
    Route::post('/support/tickets/{id}/reply', [HelzerxController::class, 'replyTicket']);
    Route::patch('/support/tickets/{id}/status', [HelzerxController::class, 'updateTicketStatus']);
    Route::post('/support/tickets/{id}/assign', [HelzerxController::class, 'assignTicket']);
    Route::post('/support/tickets/{id}/rate', [HelzerxController::class, 'rateTicket']);
    Route::post('/support/templates', [HelzerxController::class, 'createTemplate']);
    Route::post('/support/kb', [HelzerxController::class, 'createKbArticle']);
    Route::post('/support/kb/{id}/helpful', [HelzerxController::class, 'markKbHelpful']);

    // Community forum & moderation
    Route::get('/community', [HelzerxController::class, 'getCommunity']);
    Route::post('/community/posts', [HelzerxController::class, 'createPost']);
    Route::post('/community/posts/{id}/react', [HelzerxController::class, 'reactPost']);
    Route::post('/community/posts/{id}/bookmark', [HelzerxController::class, 'bookmarkPost']);
    Route::post('/community/posts/{id}/comment', [HelzerxController::class, 'commentPost']);
    Route::post('/community/posts/{id}/report', [HelzerxController::class, 'reportPost']);
    Route::post('/community/follow/{username}', [HelzerxController::class, 'toggleFollow']);
    Route::delete('/community/posts/{id}', [HelzerxController::class, 'deletePost']);
    Route::post('/community/reports/{id}/resolve', [HelzerxController::class, 'resolveReport']);

    // Announcements, incidents & notifications
    Route::get('/updates', [HelzerxController::class, 'getUpdates']);
    Route::post('/updates/announcements', [HelzerxController::class, 'createAnnouncement']);
    Route::patch('/updates/announcements/{id}', [HelzerxController::class, 'updateAnnouncement']);
    Route::delete('/updates/announcements/{id}', [HelzerxController::class, 'deleteAnnouncement']);
    Route::post('/updates/announcements/{id}/read', [HelzerxController::class, 'markAnnouncementRead']);
    Route::post('/updates/announcements/{id}/react', [HelzerxController::class, 'reactAnnouncement']);
    Route::post('/updates/announcements/{id}/comment', [HelzerxController::class, 'commentAnnouncement']);
    Route::post('/updates/incidents', [HelzerxController::class, 'createIncident']);
    Route::patch('/updates/incidents/{id}', [HelzerxController::class, 'updateIncident']);

    Route::post('/notifications/read-all', [HelzerxController::class, 'readAllNotifications']);
    Route::post('/notifications/{id}/read', [HelzerxController::class, 'readNotification']);
    Route::put('/notifications/preferences', [HelzerxController::class, 'updateNotificationPrefs']);
    Route::post('/notifications/test-webhook', [HelzerxController::class, 'testWebhook']);
});
