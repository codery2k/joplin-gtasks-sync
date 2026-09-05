import joplin from 'api';

joplin.plugins.register({
	onStart: async function() {
		// Wiring only — feature modules land in later milestones.
		console.info('Google Tasks Sync plugin started');
	},
});
