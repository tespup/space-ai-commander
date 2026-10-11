import { query } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { AIControl } from '../components/AIControl';
import { Attributes } from '../components/Attributes';

export const aiPilotSystem = (world: any) => {
  // Прямой вызов query внутри системы
  const entities = query(world, [Position, Velocity, AIControl, Attributes]);
  
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const target = AIControl.targetId[eid];
    
    if (target) {
      // Вычисляем вектор к цели
      const dx = Position.x[target] - Position.x[eid];
      const dy = Position.y[target] - Position.y[eid];
      const dist = Math.sqrt(dx * dx + dy * dy);

      // ИИ держит дистанцию, используя прокачанную скорость
      if (dist > 200) {
        Velocity.x[eid] += (dx / dist) * Attributes.speed[eid];
        Velocity.y[eid] += (dy / dist) * Attributes.speed[eid];
      }
    }
    // Инерция
    Velocity.x[eid] *= 0.95;
    Velocity.y[eid] *= 0.95;
  }
  
  return world;
};