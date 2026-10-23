# Pertes de production et interface

La saisie propose Manque d'effectif, Panne moule, Panne machine, Manque périphériques, Rupture MP, Problème qualité, Coupure d'énergie, Réglage et Autres pertes. Démarrage / arrêt et Changement de moule restent disponibles pour conserver la distinction et les données historiques. « Pannes » devient « Panne machine ».

Chaque perte est une durée en minutes. Le temps requis est l'ouverture moins les arrêts planifiés. Le temps machine est le temps requis moins toutes les pertes de disponibilité. Le bilan quotidien, la disponibilité, la performance, les chronologies et le Pareto utilisent ce même calcul. Le TRS reste le temps théorique des pièces conformes divisé par le temps requis. Le problème qualité est un arrêt ; les rebuts constituent une perte distincte de pièces.

Avec le journal détaillé, les durées sont calculées depuis les intervalles horodatés. Les champs deviennent non modifiables et les intervalles ne sont jamais additionnés une seconde fois aux totaux. Les contraintes serveur vérifient également ces règles et refusent les chevauchements ou les temps impossibles.

Les données historiques sans nouveaux champs sont lues avec une valeur zéro. La migration `supabase/06_loss_categories.sql` ajoute huit colonnes avec zéro par défaut, remplace le contrôle du journal et actualise la vue des indicateurs. Elle peut être exécutée plusieurs fois après les migrations précédentes. Elle ne réimporte aucune production et conserve les droits existants.

Les exports XLSX et CSV ajoutent les huit colonnes après les trente colonnes existantes. Les références des formules du classeur sont conservées. La sauvegarde JSON et son outil de reprise SQL préservent également ces pertes.

Les courbes du tableau de bord, TRS, DLE, TRS par machine, planning et cumul Pareto affichent les valeurs en pourcentage sur leurs points. Les zéros restent visibles, les valeurs non calculables n'affichent aucun chiffre. Les libellés et les nombres suivent la langue sélectionnée.

L'interface conserve la palette industrielle bleu et vert avec des cartes plus sobres, une meilleure hiérarchie, un groupe dédié aux pertes, un sous-total et une barre de répartition du temps. Le bandeau « Votre atelier. Une nouvelle perspective. » a été supprimé. Motion accompagne l'apparition des indicateurs par une transition d'opacité. Les dispositions et les libellés sont adaptés aux cinq langues et à l'arabe de droite à gauche.

Le sélecteur Jour / Nuit, dans la barre supérieure, applique une palette cohérente aux sept écrans, aux tableaux, aux champs, aux fenêtres et aux graphiques. Les courbes conservent des axes et des étiquettes lisibles la nuit. Le premier affichage suit le système ; le choix explicite est mémorisé sur l'appareil, synchronisé entre les onglets et appliqué avant le démarrage de React. Aucun rechargement n'est nécessaire pour changer de thème et la saisie en cours est conservée.

Les modifications du projet restent locales tant que le site n'a pas été déployé. Une base Supabase distante doit recevoir la migration `06` avant de pouvoir enregistrer les nouveaux champs.

Validation locale : 35 tests métier, SQL et Excel, 25 parcours navigateur et 5 scénarios PWA réussis, soit 65 tests distincts. Les essais couvrent notamment les neuf causes, l'absence de double comptage, les contraintes SQL, la reprise de sauvegarde, les valeurs zéro et absentes sur les courbes, les cinq langues, le mobile et la conservation des pertes hors connexion. Les essais des thèmes contrôlent les sept pages, la suppression du bandeau, les fenêtres, les contrastes des contrôles principaux, la conservation de la saisie, le choix initial du système, la préférence explicite, la synchronisation entre onglets et le rechargement du mode nuit hors connexion. Compilation de production réussie et captures jour/nuit sur bureau/mobile inspectées. Les essais utilisent une base isolée ; aucune écriture distante ni publication n'a été effectuée.
