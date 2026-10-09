import { query } from 'bitecs';
import { Position } from '../components/Position';
import { AIControl } from '../components/AIControl';

export const aiSensingSystem = (world: any) => {
  // Прямой вызов query
  const ships = query(world, [Position, AIControl]);
  const enemies = query(world, [Position]); // Тут позже добавим фильтр Faction

  for (let i = 0; i < ships.length; i++) {
    const eid = ships[i];
    
    if (AIControl.targetId[eid] <= 0) {
      // Простейший поиск ближайшего (микро-логика)
      AIControl.targetId[eid] = enemies[0] || 0; 
    }
  }
  
  return world;
};