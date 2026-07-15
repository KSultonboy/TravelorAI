const router = require('express').Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth.middleware');
const admin = require('../controllers/admin.controller');
const agency = require('../controllers/agency.controller');

router.use(adminAuthMiddleware);

router.get('/me', admin.adminMe);
router.get('/stats', admin.getStats);

router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id/block', admin.blockUser);
router.post('/users/:id/send-password-reset', admin.sendUserPasswordReset);
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

router.post('/agencies/send-password-reset', agency.adminSendPasswordReset);
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
router.patch('/feedback/:id/status', admin.updateFeedbackStatus);

// Premium admin panel qo'shimcha endpointlari
router.get('/reports', admin.getReports);
router.get('/reviews', admin.getReviews);
router.delete('/reviews/:id', admin.deleteReview);
router.delete('/tours/:id', admin.deleteAdminTour);
router.post('/business', admin.createPartner);

module.exports = router;
