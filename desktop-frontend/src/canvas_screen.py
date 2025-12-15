import os
from PyQt5 import QtWidgets
from PyQt5.QtCore import Qt, QPoint
from PyQt5.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QLabel

from src.component_library import ComponentLibrary
from src.component_widget import ComponentWidget
import src.app_state as app_state
from src.theme import apply_theme_to_screen

import json

class CanvasWidget(QWidget):
    """Simple canvas area that accepts drops and places basic widgets."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("canvasArea")
        self.setAcceptDrops(True)
        self.setStyleSheet("""
            QWidget#canvasArea {
                background: transparent;
            }
        """)
        # No layout - we handle manual positioning
        # layout = QVBoxLayout(self)
        # layout.setContentsMargins(0,0,0,0)
        self.setSizePolicy(QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Expanding)
        # self.setAttribute(Qt.WA_StyledBackground, True) # Removed debug attribute
        
        # Keep references to prevent GC
        self.components = []

        # Load component configuration (grips, labels)
        self.component_config = {}
        self._load_config()

    def _load_config(self):
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            json_path = os.path.join(base_dir, "ui", "assets", "grips.json")
            
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Create a map for easy lookup: { "Component Name": {data}, ... }
                # Handle possible fuzzy matching key variations if needed, but for now exact match
                for item in data:
                    self.component_config[item['component']] = item
            # print(f"Loaded config for {len(self.component_config)} components.")
        except Exception as e:
            print(f"Failed to load grips.json: {e}")
        
    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        text = event.mimeData().text()
        pos = event.pos()
        self.add_component_label(text, pos)
        event.acceptProposedAction()

    def mousePressEvent(self, event):
        # Deselect all if clicking on empty canvas
        self.deselect_all()
        super().mousePressEvent(event)

    def deselect_all(self):
        """Deselects all ComponentWidgets on the canvas."""
        for child in self.findChildren(ComponentWidget):
            child.set_selected(False)

    def handle_selection(self, component, add_to_selection=False):
        """Handles selection logic.
        If add_to_selection is True (Ctrl pressed), toggles the component.
        If False, deselects all others (exclusive).
        """
        if add_to_selection:
            # Toggle this one
            component.set_selected(not component.is_selected)
        else:
            # Exclusive selection
            # If we click an already selected item in a group, we typically want to KEEP the group
            # (unless we release without dragging, but for now let's keep it simple: 
            # if clicking a selected item, do nothing to others so we can drag the group)
            if component.is_selected:
                return

            self.deselect_all()
            component.set_selected(True)

    def add_component_label(self, text, pos: QPoint):
        """Creates a ComponentWidget at the drop position."""
        svg_path = self.find_svg_for_component(text)
        
        # Look up config (robust fuzzy match)
        config = self.get_component_config(text)
        
        # fallback label if config missing or no label
        if not config:
            config = {}
        if 'default_label' not in config:
            # Generate a reasonable label from text
            # e.g., "GlobeValve" -> "Globe Valve"
            import re
            label_text = re.sub(r"(\w)([A-Z])", r"\1 \2", text)
            config['default_label'] = label_text

        if not svg_path:
            # Fallback to text label if no SVG found
            lbl = QLabel(text, self)
            lbl.setAttribute(Qt.WA_TransparentForMouseEvents, False)
            lbl.move(pos)
            lbl.setStyleSheet("color: white; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px;")
            lbl.show()
            lbl.adjustSize()
            return

        comp = ComponentWidget(svg_path, self, config=config)
        comp.move(pos)
        comp.show()
        self.components.append(comp) # Keep reference

    def get_component_config(self, name):
        """Finds config by fuzzy matching name against loaded keys."""
        # 0. Apply same ID MAP as SVG finder
        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater", 
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater",
            'OilGasOrPulverizedFuelFurnace': "Oil Gas or Pulverized Fuel Furnace"
        }
        name = ID_MAP.get(name, name)

        # 1. Exact match
        if name in self.component_config:
            return self.component_config[name]

        # 2. Fuzzy match
        # Reuse robust cleaning logic
        def clean_string(s):
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))
            
        target = clean_string(name)
        
        for key, data in self.component_config.items():
            if clean_string(key) == target:
                # print(f"Fuzzy config match: '{name}' -> '{key}'")
                return data
                
        # print(f"No config found for: '{name}'")
        return {}

    def find_svg_for_component(self, name):
        """Recursively search for an SVG matching the component name in ui/assets/svg."""
        
        # 1. Handle Known ID Mappings (legacy inconsistencies)
        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater, Furnace",
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater, Furnace"
        }
        name = ID_MAP.get(name, name)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        svg_dir = os.path.join(base_dir, "ui", "assets", "svg")
        
        if not os.path.exists(svg_dir):
            print(f"Assets directory not found: {svg_dir}")
            return None

        # 2. Robust Fuzzy Match Helper
        def clean_string(s):
            # Remove spaces, commas, special chars, lowercase, including parens
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))

        search_target = clean_string(name)
        
        for root, dirs, files in os.walk(svg_dir):
            for filename in files:
                if not filename.lower().endswith(".svg"):
                    continue
                
                # Check exact match first
                if filename == f"{name}.svg":
                    return os.path.join(root, filename)
                
                # Check fuzzy match
                file_stem = filename.rsplit('.', 1)[0]
                if clean_string(file_stem) == search_target:
                    return os.path.join(root, filename)
                
        return None


class CanvasScreen(QMainWindow):
    """
    QMainWindow so we can attach docks (ComponentLibrary) easily.
    We'll embed a central QWidget named 'bgwidget' so theme.apply works.
    """
    def __init__(self):
        super().__init__()

        # central container (bgwidget) so theme.apply_theme_to_screen can find it
        central = QWidget()
        central.setObjectName("bgwidget")
        self.setCentralWidget(central)

        # layout for central area
        central_layout = QVBoxLayout(central)
        central_layout.setContentsMargins(0,0,0,0)

        # actual canvas
        self.canvas = CanvasWidget(self)
        central_layout.addWidget(self.canvas)

        # Create and add the component library (dock)
        self.library = ComponentLibrary(self)
        # library is a QDockWidget already
        self.addDockWidget(Qt.LeftDockWidgetArea, self.library)

        # allow floating / moving and max width
        self.library.setFeatures(self.library.features() | QtWidgets.QDockWidget.DockWidgetClosable)
        # If you want library initially collapsed or hidden:
        # self.library.hide()

        # Apply theme (theme module expects a child named 'bgwidget')
        apply_theme_to_screen(self)


    # Helper: expose a method to programmatically toggle the dock visibility
    def toggle_library(self, show: bool):
        self.library.setVisible(show)
