# Pour simuler une expiration de credential sans modifier l’horloge du système :
(source : Copilot, le 1/7/2026)

## Méthode recommandée

Le point important est là où vous utilisez l’access token Google pour appeler l’API YouTube. Si votre code utilise un token déjà stocké, il faut provoquer une erreur d’authentification.
Comment simuler un token expiré : forcer un access token expiré dans la base de stockage ou modifier la valeur stockée dans les credentials pour qu’elle ressemble à un token rejeté par Google

## Exemple conceptuel :
1. dans votre stockage, remplacez l’access token par une chaîne factice
2. relancez l’application
3. vérifiez si votre code déclenche bien la récupération ou la ré-authentification
4. Observer l’erreur réelle
Quand Google rejette le token, vous devriez voir un message du type :
- invalid_grant
- invalid_token
- Token has been expired or revoked
Vérifier le comportement attendu. Votre application devrait alors ne plus utiliser l’ancien token, donc demander un nouveau token ou tenter un refresh si le refresh token est encore valide.