package net.bitnp.keycloak;

import java.util.concurrent.ThreadLocalRandom;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

public final class DefaultAvatarListener implements EventListenerProvider {
    private final KeycloakSession session;

    public DefaultAvatarListener(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public void onEvent(Event event) {
        if (event.getType() != EventType.REGISTER) {
            return;
        }

        RealmModel realm = session.realms().getRealm(event.getRealmId());
        UserModel user = session.users().getUserById(realm, event.getUserId());
        String picture = user.getFirstAttribute("picture");

        if (picture == null || picture.isBlank()) {
            int image = ThreadLocalRandom.current().nextInt(1, 10);
            user.setSingleAttribute("picture", "https://s3.bitnp.net/avatar/avatars/default/" + image + ".jpg");
        }
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {}

    @Override
    public void close() {}
}
