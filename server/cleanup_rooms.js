import db from './database.js';

console.log("Rensar alla rum och deltagare...");

db.serialize(() => {
    // Ta bort alla deltagare först (för att undvika FK-problem om det finns, även om vi inte har strikta constraints)
    db.run("DELETE FROM room_participants", function (err) {
        if (err) {
            console.error("Fel vid rensning av deltagare:", err);
        } else {
            console.log(`Tog bort ${this.changes} rader från room_participants.`);

            // Ta bort alla rum
            db.run("DELETE FROM rooms", function (err) {
                if (err) {
                    console.error("Fel vid rensning av rum:", err);
                } else {
                    console.log(`Tog bort ${this.changes} rader från rooms.`);
                    console.log("Databasen städad på rum! Användare finns kvar.");
                    process.exit(0);
                }
            });
        }
    });
});
