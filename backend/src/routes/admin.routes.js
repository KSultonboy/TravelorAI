const router = require('express').Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth.middleware');
const admin = require('../controllers/admin.controller');
const billing = require('../controllers/adminBilling.controller');

router.use(adminAuthMiddleware);

router.get('/stats', admin.getStats);

// ── CRM: tariflar, obunalar, to'lovlar ──
router.get('/tariffs', billing.getTariffs);
router.post('/tariffs', billing.createTariff);
router.put('/tariffs/:id', billing.updateTariff);
router.delete('/tariffs/:id', billing.deleteTariff);

router.get('/subscriptions', billing.getSubscriptions);
router.put('/agencies/:id/subscription', billing.setAgencySubscription);

router.get('/payments', billing.getPayments);
router.post('/payments', billing.createPayment);
router.delete('/payments/:id', billing.deletePayment);

router.get('/billing/stats', billing.getBillingStats);
router.get('/reports', billing.getReports);

router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id/block', admin.blockUser);
router.delete('/users/:id', admin.deleteUser);

router.get('/trips', admin.getTrips);
router.get('/trips/:id', admin.getTrip);
router.delete('/trips/:id', admin.deleteTrip);

router.get('/places', admin.getPlaces);
router.post('/places', admin.createPlace);
router.put('/places/:id', admin.updatePlace);
router.delete('/places/:id', admin.deletePlace);

router.get('/hero-slides', admin.getHeroSlides);
router.post('/hero-slides', admin.createHeroSlide);
router.put('/hero-slides/:id', admin.updateHeroSlide);
router.delete('/hero-slides/:id', admin.deleteHeroSlide);

router.get('/agencies', admin.getAgencies);
router.post('/agencies', admin.createAgency);
router.put('/agencies/:id', admin.updateAgency);
router.delete('/agencies/:id', admin.deleteAgency);

router.get('/agency-applications', admin.getAgencyApplications);
router.patch('/agency-applications/:id/approve', admin.approveAgencyApplication);
router.patch('/agency-applications/:id/reject', admin.rejectAgencyApplication);

router.get('/tours', admin.getAdminTours);
router.patch('/tours/:id/approve', admin.approveTour);
router.patch('/tours/:id/reject', admin.rejectTour);

router.get('/bookings', admin.getBookings);
router.patch('/bookings/:id/status', admin.updateBookingStatus);

router.get('/stories', admin.getStories);
router.post('/stories', admin.createStory);
router.put('/stories/:id', admin.updateStory);
router.delete('/stories/:id', admin.deleteStory);

router.get('/transport/providers', admin.getTransportProviders);
router.post('/transport/providers', admin.createTransportProvider);
router.put('/transport/providers/:id', admin.updateTransportProvider);
router.delete('/transport/providers/:id', admin.deleteTransportProvider);

router.get('/transport/routes', admin.getTransportRoutes);
router.post('/transport/routes', admin.createTransportRoute);
router.put('/transport/routes/:id', admin.updateTransportRoute);
router.delete('/transport/routes/:id', admin.deleteTransportRoute);

router.get('/feedback', admin.getFeedback);
router.delete('/feedback/:id', admin.deleteFeedback);

module.exports = router;
