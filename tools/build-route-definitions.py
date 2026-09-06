"""Generate isolated native follow goals; no edits to kitty geometry or animation."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = root / 'behavior_pack/entities/army_cat.json'
data = json.loads(path.read_text())
entity = data['minecraft:entity']
slots = [f'kittie:route_{i}' for i in range(64)]
entity['component_groups']['kittie:depart_flee'] = {}
for i, name in enumerate(slots):
    entity['component_groups'][name] = {'minecraft:behavior.follow_mob': {
        'priority': 1, 'speed_multiplier': 1.35, 'search_range': 16,
        'stop_distance': 0.75, 'use_home_position_restriction': False,
        'filters': {'all_of': [
            {'test': 'is_family', 'subject': 'other', 'value': 'kittie_waypoint'},
            {'test': 'has_tag', 'subject': 'other', 'value': f'kittie_route_{i}'},
        ]},
    }}
    entity['events'][name] = {'remove': {'component_groups': slots}, 'add': {'component_groups': [name]}}
entity['events']['kittie:activate']['remove']['component_groups'] = ['kittie:departing', 'kittie:depart_flee'] + slots
entity['events']['kittie:depart']['remove']['component_groups'] = ['kittie:active'] + slots
entity['events']['kittie:restart_flee_off']['remove']['component_groups'] = ['kittie:depart_flee'] + slots
path.write_text(json.dumps(data, indent=2) + '\n')
