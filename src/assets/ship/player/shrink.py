import cv2
import numpy as np

def process_dots_final(input_path, output_path):
    # 1. Загружаем изображение (с поддержкой прозрачности)
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Ошибка: {input_path} не найден.")
        return

    # Если есть альфа-канал, используем его как маску
    if img.shape[2] == 4:
        mask = img[:, :, 3] # Берем прозрачность
        # Убираем альфа-канал для дальнейшей обработки цвета
        img_color = img[:, :, :3]
    else:
        # Если альфы нет, выделяем всё, что НЕ белое (фон на картинке выше был белым)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
        img_color = img

    # 2. Находим каждый отдельный кружок через связанные компоненты
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)

    # 3. Создаем пустое прозрачное полотно (черное с альфа 0)
    # Если нужен белый фон, замени на: np.ones((h, w, 3), dtype=np.uint8) * 255
    h, w = mask.shape
    result = np.zeros((h, w, 4), dtype=np.uint8)

    dots_found = 0

    for i in range(1, num_labels):
        # Пропускаем слишком мелкие артефакты (меньше 2 пикселей)
        if stats[i, cv2.CC_STAT_AREA] < 2:
            continue

        # Берем координаты центра масс
        cx, cy = int(centroids[i][0]), int(centroids[i][1])

        # Берем цвет из оригинального изображения в этой точке
        pixel_color = img_color[cy, cx]
        
        # Записываем пиксель (B, G, R, A)
        result[cy, cx] = [pixel_color[0], pixel_color[1], pixel_color[2], 255]
        dots_found += 1

    # 4. Сохраняем результат
    cv2.imwrite(output_path, result)
    print(f"Успех! Найдено точек: {dots_found}. Файл: {output_path}")

if __name__ == "__main__":
    process_dots_final('player_mask.png', 'result_final.png')