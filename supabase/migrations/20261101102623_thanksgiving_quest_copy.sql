-- Remove outdated strength labels from the quest description. Bot strength is
-- configured in the app; existing quest wins, badges, and rewards are unchanged.
update public.academy_quests
set description='Automatically active for every student. Beat Tilly Turkey, Kernel Corn, Maple Fox, Hazel Harvest, and King Chestnut in Play without hints or takebacks. Finish by November 27, 2026 at 11:59 PM Pacific. Earn 500 XP, 500 coins, and the Harvest Champion badge once. Qualifying checkmate losses make your next rematch a little easier.'
where id='thanksgiving-2026-bot-quest';
